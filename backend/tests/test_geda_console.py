"""GEDA console: the funnel, LiFE themes, communities and duels, and campaign management, scoped by role."""

from datetime import timedelta

from app.create_admin import create_admin
from app.routers.societies import MIN_GROUP_SIZE
from app.timeutil import today_ist
from conftest import HOUSEHOLD, register


def person(client, tag, district_id=1, onboard=True):
    h = register(client, email=f"{tag}@example.com", district_id=district_id)
    if onboard:
        client.put("/api/household", json=HOUSEHOLD, headers=h)
    return h


def officer(client):
    create_admin("officer@example.com", "District Officer", "officer-pass-1", district="ahmedabad")
    token = client.post("/api/auth/login", json={"email": "officer@example.com", "password": "officer-pass-1"}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def community(client, tag, kind="society", district_id=1):
    chair = person(client, f"{tag}0", district_id)
    s = client.post("/api/societies", json={"name": f"{tag} {kind}", "kind": kind}, headers=chair).json()
    members = [chair]
    for i in range(1, MIN_GROUP_SIZE):
        h = person(client, f"{tag}{i}", district_id)
        client.post("/api/societies/join", json={"code": s["join_code"]}, headers=h)
        members.append(h)
    return s, members


def test_funnel_counts_each_step(client, admin_headers):
    a = person(client, "a")
    person(client, "b")
    person(client, "c", onboard=False)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=a)
    f = client.get("/api/admin/funnel", headers=admin_headers).json()
    assert (f["registered"], f["onboarded"], f["active_7d"], f["verified"]) == (3, 2, 1, 0)


def test_themes_split_actions_and_impact(client, admin_headers):
    a = person(client, "a")
    client.post("/api/actions", data={"action_code": "geyser_off"}, headers=a)
    client.post("/api/actions", data={"action_code": "cloth_bag"}, headers=a)
    themes = {t["theme"]: t for t in client.get("/api/admin/themes", headers=admin_headers).json()}
    assert set(themes) >= {"energy", "plastic", "water"}
    assert themes["energy"]["actions"] == 1 and themes["energy"]["co2_kg"] > 0
    assert themes["plastic"]["actions"] == 1 and themes["plastic"]["co2_kg"] == 0
    assert themes["water"]["actions"] == 0


def test_communities_by_kind_top_performers_and_duels(client, admin_headers):
    a, a_members = community(client, "alpha")
    b, b_members = community(client, "beta", kind="college")
    d = client.post("/api/duels", json={"opponent_id": b["id"]}, headers=a_members[0]).json()["id"]
    client.post(f"/api/duels/{d}/accept", headers=b_members[0])
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=a_members[1])
    out = client.get("/api/admin/communities", headers=admin_headers).json()
    kinds = {k["kind"]: k for k in out["by_kind"]}
    assert kinds["society"]["communities"] == 1 and kinds["college"]["households"] == MIN_GROUP_SIZE
    assert out["top"][0]["name"] == "alpha society"
    assert len(out["duels"]) == 1 and out["duels"][0]["status"] == "active"


def test_officer_sees_only_their_district(client, admin_headers):
    person(client, "a", district_id=1)
    person(client, "b", district_id=2)
    community(client, "far", district_id=2)
    off = officer(client)
    assert client.get("/api/admin/funnel", headers=off).json()["registered"] == 1
    assert client.get("/api/admin/funnel?district_id=2", headers=off).status_code == 403
    assert client.get("/api/admin/funnel?district_id=2", headers=admin_headers).json()["registered"] == 1 + MIN_GROUP_SIZE
    assert client.get("/api/admin/communities", headers=off).json()["by_kind"] == []
    assert client.get("/api/admin/themes?district_id=2", headers=off).status_code == 403


def test_console_lists_and_runs_campaigns_and_peak_events(client, admin_headers):
    t = today_ist()
    peak = {"title": "Evening peak", "target": 10, "starts_on": str(t), "ends_on": str(t), "scope": "state",
            "kind": "peak", "start_hour": 18, "end_hour": 20}
    week = {"title": "Ahmedabad cycle week", "target": 50, "starts_on": str(t), "ends_on": str(t + timedelta(days=6)),
            "scope": "district", "scope_id": 2, "action_code": "cycle_walk"}
    assert client.post("/api/campaigns", json=peak, headers=admin_headers).status_code == 201
    assert client.post("/api/campaigns", json=week, headers=admin_headers).status_code == 201
    every = client.get("/api/admin/campaigns", headers=admin_headers).json()
    assert {c["title"] for c in every} == {"Evening peak", "Ahmedabad cycle week"}
    off = officer(client)
    assert {c["title"] for c in client.get("/api/admin/campaigns", headers=off).json()} == {"Evening peak"}
    assert client.get("/api/admin/campaigns", headers=person(client, "z")).status_code == 403
