"""Hamava Mobile API — community-powered MVNO (giffgaff model for Iran)."""
import json
import os
import re
import secrets
import time
from collections import deque
from datetime import date
from itertools import count
from threading import Lock
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

DOCS = os.getenv("HAMAVA_DOCS") == "1"  # /docs, /redoc, /openapi.json only when explicitly enabled (dev)
SECURE_COOKIE = os.getenv("HAMAVA_SECURE_COOKIE") == "1"  # set when served over HTTPS
app = FastAPI(title="Hamava Mobile API", docs_url="/docs" if DOCS else None,
              redoc_url="/redoc" if DOCS else None, openapi_url="/openapi.json" if DOCS else None)

# ponytail: in-memory store, resets on restart; swap for Postgres when real members exist
lock = Lock()
FIRST_ID = 100
ids = count(FIRST_ID)
POINTS = {"answer": 50, "accepted": 200, "referral": 500, "idea": 100}
TOMAN_PER_POINT = 100
DAILY_EARN_CAP = 500  # answer points per member per day
MAX_BODY = 16 * 1024
MAX_SESSIONS, MAX_QUESTIONS, MAX_ANSWERS, MAX_BUCKETS = 20_000, 1_000, 100, 50_000
RATES = {"read": (60, 20.0), "write": (10, 0.5)}  # token bucket: burst, refill per second

PLANS = [
    {"id": "basic", "price": 99, "data": 10, "minutes": 200, "sms": 100, "tag": "student"},
    {"id": "plus", "price": 189, "data": 40, "minutes": 500, "sms": 300, "tag": "popular"},
    {"id": "max", "price": 349, "data": 120, "minutes": 2000, "sms": 1000, "tag": "creator"},
]
CHARITIES = [
    {"id": "mahak", "raised": 18_400_000},
    {"id": "school", "raised": 9_750_000},
    {"id": "forest", "raised": 6_120_000},
]


def seed_member() -> dict:
    # ponytail: every visitor gets a demo profile until real sign-up (phone + OTP) exists
    return {
        "name": {"fa": "سارا", "en": "Sara"}, "phone": "0990 123 2026", "plan": "plus", "points": 2350,
        "credit": 120_000, "cash_pending": 0, "referral": "HAMAVA-SARA",
        "usage": {"data": 26.4, "minutes": 212, "sms": 41}, "renews_in": 12,
    }


# seed content is bilingual {fa, en}; user-posted content is a plain string
questions = [
    {"id": 1, "tag": "esim", "votes": 42,
     "title": {"fa": "چطور eSIM را روی آیفون فعال کنم؟", "en": "How do I activate eSIM on iPhone?"},
     "answers": [{"id": 2, "author": {"fa": "رضا", "en": "Reza"}, "accepted": True,
                  "body": {"fa": "از مسیر تنظیمات ← شبکه تلفن همراه ← افزودن eSIM، کد QR داخل پیش‌خوان را اسکن کنید.",
                           "en": "Settings → Cellular → Add eSIM, then scan the QR code from your dashboard."}}]},
    {"id": 3, "tag": "plans", "votes": 31,
     "title": {"fa": "دیتای مصرف‌نشده به ماه بعد منتقل می‌شود؟", "en": "Does unused data roll over?"},
     "answers": [{"id": 4, "author": {"fa": "مینا", "en": "Mina"}, "accepted": False,
                  "body": {"fa": "بله، تا ۵۰٪ دیتای مصرف‌نشده به ماه بعد منتقل می‌شود.",
                           "en": "Yes — up to 50% of unused data carries over to next month."}}]},
    {"id": 6, "tag": "plans", "votes": 24,
     "title": {"fa": "چطور بسته‌ام را وسط ماه تغییر دهم؟", "en": "How do I switch plans mid-month?"},
     "answers": [{"id": 7, "author": {"fa": "امیر", "en": "Amir"}, "accepted": True,
                  "body": {"fa": "در پیش‌خوان بخش بسته‌ها را باز کنید. تغییر از ابتدای دوره بعد اعمال می‌شود.",
                           "en": "Open Plans in your dashboard. The change applies from your next cycle."}}]},
    {"id": 5, "tag": "network", "votes": 18, "answers": [],
     "title": {"fa": "بهترین تنظیمات APN برای پینگ پایین در بازی چیست؟", "en": "Best APN settings for low gaming ping?"}},
]
orders: deque[dict] = deque(maxlen=10_000)  # bounded: PII is kept only for recent fulfilment
sessions: dict[str, dict] = {}  # sid -> member + private anti-abuse state; insertion order = LRU
buckets: dict[str, tuple[float, float]] = {}  # rate-limit key -> (tokens, last seen); event-loop only

# ---------- input hygiene ----------
DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
PHONE = re.compile(r"(?:\+98|0098|0)?(9\d{9})")
# control chars and bidi overrides/isolates (spoofing); ZWNJ/LRM/RLM stay, Persian needs them
UNSAFE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f‪-‮⁦-⁩]")


def clean(v):
    return UNSAFE.sub("", v).strip() if isinstance(v, str) else v


class Question(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    tag: Literal["esim", "plans", "network", "general"] = "general"
    _clean = field_validator("title", mode="before")(clean)


class Answer(BaseModel):
    body: str = Field(min_length=3, max_length=2000)
    _clean = field_validator("body", mode="before")(clean)


class Redeem(BaseModel):
    kind: Literal["topup", "cash", "charity"]
    points: int = Field(ge=50, le=1_000_000)
    charity: Literal["mahak", "school", "forest"] | None = None


class SimOrder(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(max_length=24)
    city: str = Field(min_length=2, max_length=60)
    plan: Literal["basic", "plus", "max"]
    esim: bool = False
    _clean = field_validator("name", "city", mode="before")(clean)

    @field_validator("phone")
    @classmethod
    def iranian_mobile(cls, v: str) -> str:
        m = PHONE.fullmatch(re.sub(r"[\s-]", "", v.translate(DIGITS)))
        if not m:
            raise ValueError("not an Iranian mobile number")
        return "0" + m[1]  # canonical 09xxxxxxxxx


# ---------- edge guard ----------
SEC_HEADERS = [(b"x-content-type-options", b"nosniff"), (b"referrer-policy", b"no-referrer"),
               (b"x-frame-options", b"DENY"), (b"cross-origin-resource-policy", b"same-origin")]
if not DOCS:  # Swagger UI needs scripts; the JSON API needs nothing
    SEC_HEADERS.append((b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"))
SID = re.compile(rb"(?:^|;)\s*sid=([\w-]{20,64})")


def take(key: str, kind: str) -> float:
    """Token bucket. Returns 0 if allowed, else seconds to wait. O(1); dict order doubles as LRU."""
    cap, rate = RATES[kind]
    now = time.monotonic()
    tokens, ts = buckets.pop(key, (cap, now))
    tokens = min(cap, tokens + (now - ts) * rate)
    buckets[key] = (tokens - 1 if tokens >= 1 else tokens, now)
    if len(buckets) > MAX_BUCKETS:
        buckets.pop(next(iter(buckets)))
    return 0 if tokens >= 1 else (1 - tokens) / rate


async def deny(send, status: int, detail: str, extra=()):
    body = json.dumps({"detail": detail}).encode()
    await send({"type": "http.response.start", "status": status, "headers": [
        (b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
        (b"cache-control", b"no-store"), *SEC_HEADERS, *extra]})
    await send({"type": "http.response.body", "body": body})


def replay(body: bytes, receive):
    """Hand the buffered body to the app once, then pass through (disconnect events)."""
    sent = False

    async def wrapped():
        nonlocal sent
        if sent:
            return await receive()
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}
    return wrapped


class Guard:
    """Pure ASGI (no BaseHTTPMiddleware task/buffering): rate limit, same-origin JSON-only writes,
    body cap, security headers. All checks are O(1) and run before any parsing."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        h = dict(scope["headers"])
        write = scope["method"] not in ("GET", "HEAD", "OPTIONS")
        m = SID.search(h.get(b"cookie", b""))
        sid = m and m[1].decode()
        # known session -> per-member bucket; otherwise per client IP (uvicorn resolves X-Forwarded-For
        # from trusted proxies only). ponytail: in-process limiter; use the edge proxy's when scaling out
        key = sid if sid in sessions else (scope.get("client") or ("?",))[0]
        if wait := take(f"{'write' if write else 'read'}:{key}", "write" if write else "read"):
            return await deny(send, 429, "too many requests", [(b"retry-after", str(int(wait) + 1).encode())])
        if write:
            if h.get(b"sec-fetch-site", b"same-origin") not in (b"same-origin", b"none"):
                return await deny(send, 403, "cross-site request blocked")  # CSRF, on top of SameSite=Lax
            if not h.get(b"content-type", b"").startswith(b"application/json"):
                return await deny(send, 415, "send application/json")
            body, more = b"", True
            while more:  # buffer at most MAX_BODY, whether Content-Length or chunked
                msg = await receive()
                if msg["type"] == "http.disconnect":
                    return
                body += msg.get("body", b"")
                if len(body) > MAX_BODY:
                    return await deny(send, 413, "request body too large")
                more = msg.get("more_body", False)
            receive = replay(body, receive)

        async def send_secure(msg):
            if msg["type"] == "http.response.start":
                hs = msg["headers"] = [*msg.get("headers", ()), *SEC_HEADERS]
                if not any(k.lower() == b"cache-control" for k, _ in hs):
                    hs.append((b"cache-control", b"no-store"))
            await send(msg)

        await self.app(scope, receive, send_secure)


app.add_middleware(Guard)


# ---------- sessions ----------
def session(request: Request, response: Response) -> dict:
    """Per-visitor member. Opaque random id, server-side state, HttpOnly + SameSite=Lax cookie."""
    sid = request.cookies.get("sid", "")
    with lock:
        s = sessions.pop(sid, None)
        if s is None:
            sid = secrets.token_urlsafe(24)
            s = {"member": seed_member(), "voted": set(), "rewarded": set(), "asked": set(),
                 "day": date.today(), "earned": 0}
            response.set_cookie("sid", sid, max_age=30 * 86400, httponly=True, samesite="lax",
                                secure=SECURE_COOKIE)
            if len(sessions) >= MAX_SESSIONS:
                sessions.pop(next(iter(sessions)))  # evict least recently used
        sessions[sid] = s
    return s


def find(qid: int) -> dict:
    q = next((q for q in questions if q["id"] == qid), None)
    if not q:
        raise HTTPException(404, "question not found")
    return q


# ---------- routes ----------
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/plans")
def plans(response: Response):
    response.headers["Cache-Control"] = "public, max-age=300"
    return PLANS


@app.get("/api/stats")
def stats(response: Response):
    response.headers["Cache-Control"] = "public, max-age=30"
    return {"members": 212_480, "answered": 96.4, "avg_minutes": 7, "donated": sum(c["raised"] for c in CHARITIES),
            "charities": CHARITIES, "points": POINTS}


@app.get("/api/me")
def me(s: dict = Depends(session)):
    return s["member"]


@app.get("/api/questions")
def list_questions():
    with lock:
        return sorted(questions, key=lambda q: -q["votes"])


@app.post("/api/questions", status_code=201)
def ask(q: Question, s: dict = Depends(session)):
    with lock:
        item = {"id": next(ids), "title": q.title, "tag": q.tag, "votes": 0, "answers": []}
        questions.append(item)
        s["asked"].add(item["id"])
        if len(questions) > MAX_QUESTIONS:  # drop the oldest member question; seed content stays
            questions.remove(next(x for x in questions if x["id"] >= FIRST_ID))
    return item


@app.post("/api/questions/{qid}/answers", status_code=201)
def answer(qid: int, a: Answer, s: dict = Depends(session)):
    m = s["member"]
    with lock:
        q = find(qid)
        if len(q["answers"]) >= MAX_ANSWERS:
            raise HTTPException(409, "this question has enough answers")
        item = {"id": next(ids), "author": m["name"], "body": a.body, "accepted": False}
        q["answers"].append(item)
        if s["day"] != date.today():
            s["day"], s["earned"] = date.today(), 0
        # paid once per question, never for your own question, capped per day
        earned = 0 if qid in s["rewarded"] or qid in s["asked"] else min(POINTS["answer"], DAILY_EARN_CAP - s["earned"])
        if earned > 0:
            s["rewarded"].add(qid)
            s["earned"] += earned
            m["points"] += earned
    return {"answer": item, "earned": max(earned, 0), "points": m["points"]}


@app.post("/api/questions/{qid}/vote")
def vote(qid: int, s: dict = Depends(session)):
    with lock:
        q = find(qid)
        if qid not in s["voted"]:  # one vote per member; repeats are a no-op
            s["voted"].add(qid)
            q["votes"] += 1
    return q


@app.post("/api/redeem")
def redeem(r: Redeem, s: dict = Depends(session)):
    m = s["member"]
    with lock:
        if r.points > m["points"]:
            raise HTTPException(400, "not enough points")
        toman = r.points * TOMAN_PER_POINT
        if r.kind == "charity":
            c = next((c for c in CHARITIES if c["id"] == r.charity), None)
            if not c:
                raise HTTPException(400, "unknown charity")
            c["raised"] += toman
        elif r.kind == "cash":
            m["cash_pending"] += toman  # a payout request, never spendable credit
        else:
            m["credit"] += toman
        m["points"] -= r.points
    return m


@app.post("/api/orders", status_code=201)
def order(o: SimOrder):
    with lock:
        item = {"id": next(ids), **o.model_dump(), "status": "processing"}
        orders.append(item)
    return item
