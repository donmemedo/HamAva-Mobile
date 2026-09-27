from fastapi.testclient import TestClient

from main import app, member

c = TestClient(app)


def test_flow():
    assert len(c.get("/api/plans").json()) == 3
    p0 = member["points"]
    q = c.post("/api/questions", json={"title": "Does eSIM work on Pixel?"}).json()
    r = c.post(f"/api/questions/{q['id']}/answers", json={"body": "Yes it does"}).json()
    assert r["points"] == p0 + 50
    assert c.post("/api/redeem", json={"kind": "topup", "points": 10**9}).status_code == 400
    credit = member["credit"]
    assert c.post("/api/redeem", json={"kind": "topup", "points": 100}).json()["credit"] == credit + 10_000
    assert c.post("/api/redeem", json={"kind": "charity", "points": 10, "charity": "nope"}).status_code == 400
    assert c.post("/api/orders", json={"name": "Ali", "phone": "09123456789", "city": "Tehran", "plan": "plus"}).status_code == 201
    assert c.post("/api/orders", json={"name": "Ali", "phone": "abc", "city": "Tehran", "plan": "plus"}).status_code == 422
