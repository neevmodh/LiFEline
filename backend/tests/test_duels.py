"""Duels: two communities compete for 30 days on CO2 avoided per household, counted only when 40% take part."""

from conftest import HOUSEHOLD, register

from app.routers.duels import PARTICIPATION_FLOOR
from app.routers.societies import MIN_GROUP_SIZE


def person(client, tag):
    h = register(client, email=f"{tag}@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    return h


def community(client, tag, size=MIN_GROUP_SIZE):
    chair = person(client, f"{tag}0")
    s = client.post("/api/societies", json={"name": f"{tag} Society"}, headers=chair).json()
    members = [chair]
    for i in range(1, size):
        h = person(client, f"{tag}{i}")
        client.post("/api/societies/join", json={"code": s["join_code"]}, headers=h)
        members.append(h)
    return s, members


def act(client, headers, code="cycle_walk"):
    assert client.post("/api/actions", data={"action_code": code}, headers=headers).status_code == 201


def test_only_committees_can_challenge_and_accept(client):
    _a, a_members = community(client, "alpha")
    b, b_members = community(client, "beta")
    assert client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[1]).status_code == 403
    duel = client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0])
    assert duel.status_code == 201 and duel.json()["status"] == "pending"
    d = duel.json()["id"]
    assert client.post(f"/api/duels/{d}/accept", headers=a_members[0]).status_code == 403  # challenger can't accept
    assert client.post(f"/api/duels/{d}/accept", headers=b_members[1]).status_code == 403  # not committee
    accepted = client.post(f"/api/duels/{d}/accept", headers=b_members[0]).json()
    assert accepted["status"] == "active" and accepted["days_left"] == 30


def test_cannot_duel_yourself_or_twice(client):
    a, a_members = community(client, "alpha")
    b, _ = community(client, "beta")
    assert client.post("/api/duels", json={"opponent_id": a["id"]}, headers=a_members[0]).status_code == 422
    assert client.post("/api/duels", json={"opponent_id": 999}, headers=a_members[0]).status_code == 404
    assert client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0]).status_code == 201
    assert client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0]).status_code == 409


def test_participation_floor_decides_what_counts(client):
    _a, a_members = community(client, "alpha")
    b, b_members = community(client, "beta")
    d = client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0]).json()["id"]
    client.post(f"/api/duels/{d}/accept", headers=b_members[0])

    # Alpha: 2 of 5 households act (40%, at the floor). Beta: 1 of 5 acts (20%, below it).
    act(client, a_members[0])
    act(client, a_members[1])
    act(client, b_members[0])
    act(client, b_members[0], "stairs")

    duel = client.get("/api/duels/mine", headers=a_members[2]).json()[0]
    me, them = duel["us"], duel["them"]
    assert me["participation_pct"] == 40 and me["counts"] is True and me["co2_per_member_kg"] > 0
    assert them["participation_pct"] == 20 and them["counts"] is False and them["co2_per_member_kg"] is None
    assert duel["leader"] == "us"
    assert PARTICIPATION_FLOOR == 0.4


def test_actions_before_the_duel_started_dont_count(client):
    _a, a_members = community(client, "alpha")
    b, b_members = community(client, "beta")
    act(client, a_members[0])
    act(client, a_members[1])
    d = client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0]).json()["id"]
    client.post(f"/api/duels/{d}/accept", headers=b_members[0])
    us = client.get("/api/duels/mine", headers=a_members[0]).json()[0]["us"]
    assert us["participation_pct"] == 0 and us["counts"] is False


def test_decline_and_non_members(client):
    _a, a_members = community(client, "alpha")
    b, b_members = community(client, "beta")
    d = client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0]).json()["id"]
    assert client.post(f"/api/duels/{d}/decline", headers=b_members[0]).json()["status"] == "declined"
    loner = person(client, "loner")
    assert client.get("/api/duels/mine", headers=loner).json() == []


def test_deleting_an_account_keeps_duels_and_campaigns_consistent(client):
    """A committee member who started a duel or a campaign can still delete their account."""
    from datetime import timedelta

    from app.timeutil import today_ist

    a, a_members = community(client, "alpha")
    b, b_members = community(client, "beta")
    d = client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0]).json()["id"]
    client.post(f"/api/duels/{d}/accept", headers=b_members[0])
    t = today_ist()
    campaign = {"title": "Alpha cycle week", "target": 5, "starts_on": str(t), "ends_on": str(t + timedelta(days=6)),
                "scope": "society", "action_code": "cycle_walk"}
    assert client.post("/api/campaigns", json=campaign, headers=a_members[0]).status_code == 201

    # The duel's creator leaves Nidhi: the duel carries on for both communities.
    assert client.request("DELETE", "/api/account", json={"password": "secret123"}, headers=a_members[0]).status_code == 204
    assert client.get("/api/duels/mine", headers=b_members[0]).json()[0]["status"] == "active"

    # Everyone in alpha leaves: the empty community and its duel go with it.
    for h in a_members[1:]:
        assert client.request("DELETE", "/api/account", json={"password": "secret123"}, headers=h).status_code == 204
    assert client.get("/api/duels/mine", headers=b_members[0]).json() == []
