"""Societies: join codes, committee powers, and totals that stay hidden below 5 households."""

import pytest

from app.routers.societies import MIN_GROUP_SIZE
from conftest import HOUSEHOLD, register


def member(client, n, district_id=1):
    headers = register(client, email=f"m{n}@example.com", district_id=district_id)
    client.put("/api/household", json=HOUSEHOLD, headers=headers)
    return headers


@pytest.fixture()
def society(client):
    chair = member(client, 0)
    created = client.post("/api/societies", json={"name": "Shanti Apartments", "goal_kg_month": 100}, headers=chair)
    assert created.status_code == 201
    return chair, created.json()


def test_creator_becomes_committee_with_a_join_code(client, society):
    chair, s = society
    assert s["role"] == "committee" and s["member_count"] == 1 and len(s["join_code"]) == 8
    assert set(s["join_code"]) <= set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    assert client.get("/api/auth/me", headers=chair).json()["society_role"] == "committee"
    assert client.post("/api/societies", json={"name": "Another One"}, headers=chair).status_code == 409


def test_join_with_code_members_dont_see_the_code_or_member_list(client, society):
    chair, s = society
    ravi = member(client, 1)
    assert client.post("/api/societies/join", json={"code": "WRONGCODE"}, headers=ravi).status_code == 404
    joined = client.post("/api/societies/join", json={"code": s["join_code"].lower()}, headers=ravi).json()
    assert joined["role"] == "member" and joined["join_code"] is None and joined["members"] is None
    assert client.post("/api/societies/join", json={"code": s["join_code"]}, headers=ravi).status_code == 409
    assert client.get("/api/societies/mine", headers=chair).json()["member_count"] == 2


def test_totals_stay_hidden_until_five_households_join(client, society):
    chair, s = society
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=chair)
    small = client.get("/api/societies/mine", headers=chair).json()
    assert small["stats_visible"] is False and small["co2_avoided_kg"] is None and small["goal_progress_pct"] is None
    assert client.get("/api/societies/report.csv", headers=chair).status_code == 409

    for n in range(1, MIN_GROUP_SIZE):
        client.post("/api/societies/join", json={"code": s["join_code"]}, headers=member(client, n))
    big = client.get("/api/societies/mine", headers=chair).json()
    assert big["stats_visible"] is True and big["co2_avoided_kg"] > 0 and big["actions"] == 1
    assert big["goal_progress_pct"] == round(big["co2_avoided_kg"] / 100 * 100, 1)
    csv = client.get("/api/societies/report.csv", headers=chair)
    assert csv.status_code == 200 and "m1@example.com" not in csv.text and "Shanti Apartments" in csv.text


def test_committee_sees_first_names_and_counts_only(client, society):
    chair, s = society
    client.post("/api/societies/join", json={"code": s["join_code"]}, headers=member(client, 1))
    view = client.get("/api/societies/mine", headers=chair).json()
    assert [m["role"] for m in view["members"]] == ["committee", "member"]
    assert set(view["members"][0]) == {"user_id", "first_name", "role", "actions_this_month"}  # no email or bills


def test_only_the_committee_can_manage(client, society):
    chair, s = society
    ravi = member(client, 1)
    client.post("/api/societies/join", json={"code": s["join_code"]}, headers=ravi)
    for call in (
        lambda: client.patch("/api/societies/goal", json={"goal_kg_month": 5}, headers=ravi),
        lambda: client.post("/api/societies/announcements", json={"text": "hi"}, headers=ravi),
        lambda: client.get("/api/societies/report.csv", headers=ravi),
    ):
        assert call().status_code == 403
    posted = client.post("/api/societies/announcements", json={"text": "AC at 24 this week!"}, headers=chair).json()
    assert posted["announcements"][0]["text"] == "AC at 24 this week!"
    seen = client.get("/api/societies/mine", headers=ravi).json()  # members read announcements
    assert seen["announcements"][0]["author"] == "Asha"
    assert client.delete(f"/api/societies/announcements/{seen['announcements'][0]['id']}", headers=chair).status_code == 204


def test_promote_remove_and_a_society_always_keeps_a_committee(client, society):
    chair, s = society
    ravi = member(client, 1)
    client.post("/api/societies/join", json={"code": s["join_code"]}, headers=ravi)
    uid = client.get("/api/auth/me", headers=ravi).json()["id"]
    assert client.post(f"/api/societies/members/{uid}/committee", headers=chair).status_code == 200
    assert client.get("/api/auth/me", headers=ravi).json()["society_role"] == "committee"

    mina = member(client, 2)
    client.post("/api/societies/join", json={"code": s["join_code"]}, headers=mina)
    # Both committee members leave in turn: the remaining member is promoted, then the empty society disappears.
    client.post("/api/societies/leave", headers=chair)
    client.post("/api/societies/leave", headers=ravi)
    assert client.get("/api/auth/me", headers=mina).json()["society_role"] == "committee"
    client.post("/api/societies/leave", headers=mina)
    assert client.get("/api/societies/mine", headers=mina).status_code == 404
    assert client.post("/api/societies/join", json={"code": s["join_code"]}, headers=mina).status_code == 404


def test_leaderboard_ranks_only_societies_with_enough_members(client, society):
    chair, s = society
    for n in range(1, MIN_GROUP_SIZE):
        client.post("/api/societies/join", json={"code": s["join_code"]}, headers=member(client, n))
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=chair)
    other = member(client, 10)
    client.post("/api/societies", json={"name": "Tiny Society"}, headers=other)  # 1 member: not ranked
    board = client.get("/api/societies/leaderboard", headers=chair).json()
    assert [(r["name"], r["rank"], r["is_mine"]) for r in board] == [("Shanti Apartments", 1, True)]
    assert client.get("/api/societies/mine", headers=chair).json()["rank"] == 1


def test_deleting_an_account_leaves_the_society_cleanly(client, society):
    chair, s = society
    ravi = member(client, 1)
    client.post("/api/societies/join", json={"code": s["join_code"]}, headers=ravi)
    client.post("/api/societies/announcements", json={"text": "hello"}, headers=chair)
    assert client.request("DELETE", "/api/account", json={"password": "secret123"}, headers=chair).status_code == 204
    assert client.get("/api/auth/me", headers=ravi).json()["society_role"] == "committee"  # promoted
    assert client.get("/api/societies/mine", headers=ravi).json()["announcements"] == []
