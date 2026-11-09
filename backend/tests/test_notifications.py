"""Notification centre: created by real events, shown in the reader's language."""

from conftest import HOUSEHOLD, register


def citizen(client, n):
    h = register(client, email=f"n{n}@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    return h


def test_announcement_notifies_other_members_not_the_author(client):
    chair, ravi = citizen(client, 1), citizen(client, 2)
    code = client.post("/api/societies", json={"name": "Shanti Apartments"}, headers=chair).json()["join_code"]
    client.post("/api/societies/join", json={"code": code}, headers=ravi)
    client.post("/api/societies/announcements", json={"text": "AC at 24 this week"}, headers=chair)
    got = client.get("/api/notifications", headers=ravi).json()
    assert got["unread"] == 1 and "AC at 24 this week" in got["items"][0]["body"]
    assert client.get("/api/notifications", headers=chair).json()["unread"] == 0


def test_mark_read_clears_unread_and_each_user_sees_only_their_own(client):
    chair, ravi = citizen(client, 1), citizen(client, 2)
    code = client.post("/api/societies", json={"name": "Shanti Apartments"}, headers=chair).json()["join_code"]
    client.post("/api/societies/join", json={"code": code}, headers=ravi)
    client.post("/api/societies/announcements", json={"text": "Hello"}, headers=chair)
    assert client.post("/api/notifications/read", headers=ravi).status_code == 204
    after = client.get("/api/notifications", headers=ravi).json()
    assert after["unread"] == 0 and after["items"][0]["read"] is True


def test_proof_decision_notifies_the_citizen(client, admin_headers):
    from conftest import photo

    ravi = citizen(client, 1)
    r = client.post("/api/actions", data={"action_code": "cycle_walk"},
                    files={"proof": ("p.png", photo(3), "image/png")}, headers=ravi)
    assert r.status_code in (200, 201)
    pending = client.get("/api/admin/reviews", headers=admin_headers).json()
    assert pending, "a photo-backed action should be queued for review"
    assert client.post(f"/api/admin/reviews/{pending[0]['id']}", json={"approve": False}, headers=admin_headers).status_code == 204
    got = client.get("/api/notifications", headers=ravi).json()
    assert got["items"][0]["title"] == "Your photo was not accepted"
