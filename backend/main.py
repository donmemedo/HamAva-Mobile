"""Hamava Mobile API — community-powered MVNO (giffgaff model for Iran)."""
from itertools import count
from threading import Lock
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Hamava Mobile API")

# ponytail: in-memory store, resets on restart; swap for Postgres when real members exist
lock = Lock()
ids = count(100)
POINTS = {"answer": 50, "accepted": 200, "referral": 500, "idea": 100}

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
# seed content is bilingual {fa, en}; user-posted content is a plain string
member = {
    "name": {"fa": "سارا", "en": "Sara"}, "phone": "0990 123 2026", "plan": "plus", "points": 2350,
    "credit": 120_000, "referral": "HAMAVA-SARA",
    "usage": {"data": 26.4, "minutes": 212, "sms": 41}, "renews_in": 12,
}
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
orders: list[dict] = []


class Question(BaseModel):
    title: str = Field(min_length=5, max_length=200)
    tag: str = Field(default="general", max_length=20)


class Answer(BaseModel):
    body: str = Field(min_length=3, max_length=2000)


class Redeem(BaseModel):
    kind: Literal["topup", "cash", "charity"]
    points: int = Field(gt=0)
    charity: str | None = None


class SimOrder(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern=r"^[0-9۰-۹+ ]{10,15}$")
    city: str = Field(min_length=2, max_length=60)
    plan: str
    esim: bool = False


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/plans")
def plans():
    return PLANS


@app.get("/api/stats")
def stats():
    return {"members": 212_480, "answered": 96.4, "avg_minutes": 7, "donated": sum(c["raised"] for c in CHARITIES),
            "charities": CHARITIES, "points": POINTS}


@app.get("/api/me")
def me():
    return member


@app.get("/api/questions")
def list_questions():
    return sorted(questions, key=lambda q: -q["votes"])


@app.post("/api/questions", status_code=201)
def ask(q: Question):
    with lock:
        item = {"id": next(ids), "title": q.title, "tag": q.tag, "votes": 0, "answers": []}
        questions.append(item)
    return item


@app.post("/api/questions/{qid}/answers", status_code=201)
def answer(qid: int, a: Answer):
    with lock:
        q = next((q for q in questions if q["id"] == qid), None)
        if not q:
            raise HTTPException(404, "question not found")
        item = {"id": next(ids), "author": member["name"], "body": a.body, "accepted": False}
        q["answers"].append(item)
        member["points"] += POINTS["answer"]
    return {"answer": item, "earned": POINTS["answer"], "points": member["points"]}


@app.post("/api/questions/{qid}/vote")
def vote(qid: int):
    with lock:
        q = next((q for q in questions if q["id"] == qid), None)
        if not q:
            raise HTTPException(404, "question not found")
        q["votes"] += 1
    return q


@app.post("/api/redeem")
def redeem(r: Redeem):
    with lock:
        if r.points > member["points"]:
            raise HTTPException(400, "not enough points")
        if r.kind == "charity":
            c = next((c for c in CHARITIES if c["id"] == r.charity), None)
            if not c:
                raise HTTPException(400, "unknown charity")
            c["raised"] += r.points * 100  # 1 point = 100 toman
        else:
            member["credit"] += r.points * 100
        member["points"] -= r.points
    return member


@app.post("/api/orders", status_code=201)
def order(o: SimOrder):
    if o.plan not in {p["id"] for p in PLANS}:
        raise HTTPException(400, "unknown plan")
    with lock:
        item = {"id": next(ids), **o.model_dump(), "status": "processing"}
        orders.append(item)
    return item
