from fastapi.testclient import TestClient

import main
from main import app


def client() -> TestClient:
    """Fresh visitor with an established session and clean rate-limit buckets."""
    main.buckets.clear()
    c = TestClient(app)
    c.get("/api/me")
    return c


def test_flow():
    c = client()
    assert len(c.get("/api/plans").json()) == 3
    p0 = c.get("/api/me").json()["points"]
    q = client().post("/api/questions", json={"title": "Does eSIM work on Pixel?"}).json()
    r = c.post(f"/api/questions/{q['id']}/answers", json={"body": "Yes it does"}).json()
    assert r["earned"] == 50 and r["points"] == p0 + 50
    assert c.post("/api/redeem", json={"kind": "topup", "points": 10**6}).status_code == 400
    credit = c.get("/api/me").json()["credit"]
    assert c.post("/api/redeem", json={"kind": "topup", "points": 100}).json()["credit"] == credit + 10_000
    assert c.post("/api/redeem", json={"kind": "charity", "points": 50, "charity": "nope"}).status_code == 422
    assert c.post("/api/orders", json={"name": "Ali", "phone": "09123456789", "city": "Tehran", "plan": "plus"}).status_code == 201
    assert c.post("/api/orders", json={"name": "Ali", "phone": "abc", "city": "Tehran", "plan": "plus"}).status_code == 422


def test_sessions_are_isolated():  # B1
    a, b = client(), client()
    assert a.cookies["sid"] != b.cookies["sid"]
    cookie = TestClient(app).get("/api/me").headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    a.post("/api/redeem", json={"kind": "topup", "points": 1000})
    assert a.get("/api/me").json()["points"] == b.get("/api/me").json()["points"] - 1000


def test_points_are_earned_once_and_capped():  # B2
    c, other = client(), client()
    mine = c.post("/api/questions", json={"title": "My own question here"}).json()["id"]
    assert c.post(f"/api/questions/{mine}/answers", json={"body": "self answer"}).json()["earned"] == 0
    qid = other.post("/api/questions", json={"title": "Someone else asks"}).json()["id"]
    assert c.post(f"/api/questions/{qid}/answers", json={"body": "first"}).json()["earned"] == 50
    assert c.post(f"/api/questions/{qid}/answers", json={"body": "again"}).json()["earned"] == 0
    main.sessions[c.cookies["sid"]]["earned"] = main.DAILY_EARN_CAP
    q2 = other.post("/api/questions", json={"title": "Another question"}).json()["id"]
    assert c.post(f"/api/questions/{q2}/answers", json={"body": "over cap"}).json()["earned"] == 0


def test_one_vote_per_member():  # B3
    c = client()
    v0 = c.post("/api/questions/5/vote", json={}).json()["votes"]
    assert c.post("/api/questions/5/vote", json={}).json()["votes"] == v0


def test_cash_is_a_payout_request():  # B4
    c = client()
    m0 = c.get("/api/me").json()
    m1 = c.post("/api/redeem", json={"kind": "cash", "points": 100}).json()
    assert m1["credit"] == m0["credit"] and m1["cash_pending"] == m0["cash_pending"] + 10_000


def test_body_cap_and_rate_limit():  # B5
    c = client()
    assert c.post("/api/questions", json={"title": "x" * 20_000}).status_code == 413
    codes = [c.post("/api/questions/5/vote", json={}).status_code for _ in range(12)]
    assert codes[0] == 200 and codes[-1] == 429
    assert c.post("/api/questions/5/vote", json={}).headers["retry-after"]


def test_csrf_and_content_type():  # CSRF defence in depth
    c = client()
    assert c.post("/api/redeem", json={"kind": "topup", "points": 50}, headers={"sec-fetch-site": "cross-site"}).status_code == 403
    assert c.post("/api/redeem", content='{"kind":"topup","points":50}', headers={"content-type": "text/plain"}).status_code == 415


def test_headers_docs_and_cache():  # B7, B8
    c = client()
    assert c.get("/docs").status_code == 404 and c.get("/openapi.json").status_code == 404
    me = c.get("/api/me").headers
    assert me["x-content-type-options"] == "nosniff" and me["cache-control"] == "no-store"
    plans = TestClient(app).get("/api/plans").headers
    assert plans["cache-control"].startswith("public") and "set-cookie" not in plans


def test_phone_is_canonical():  # B9
    c = client()
    order = lambda phone: c.post("/api/orders", json={"name": "Ali", "phone": phone, "city": "Tehran", "plan": "plus"})
    assert order("۰۹۱۲ ۳۴۵ ۶۷۸۹").json()["phone"] == "09123456789"
    assert order("+98 912-345-6789").json()["phone"] == "09123456789"
    assert [order(p).status_code for p in ("+1 555 555 5555", "1234567890", "0912345678")] == [422] * 3


def test_tags_and_bidi_controls():  # B10, F3
    c = client()
    assert c.post("/api/questions", json={"title": "tag test", "tag": "<b>x</b>"}).status_code == 422
    q = c.post("/api/questions", json={"title": "abc‮fed‌ ghi"}).json()
    assert q["title"] == "abcfed‌ ghi"  # override stripped, ZWNJ kept
