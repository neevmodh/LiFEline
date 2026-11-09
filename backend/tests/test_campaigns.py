"""Campaigns: who may launch them, who they cover, and progress counted from real actions."""

from datetime import timedelta

from app.timeutil import today_ist
from conftest import HOUSEHOLD, register


def body(**kw):
    t = today_ist()
    base = {"title": "Cycle to work week", "target": 5, "starts_on": str(t), "ends_on": str(t + timedelta(days=6)),
            "scope": "state", "action_code": "cycle_walk"}
    return {**base, **kw}


def citizen(client, n, district_id=1):
    h = register(client, email=f"c{n}@example.com", district_id=district_id)
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    return h


def test_only_geda_runs_statewide_and_district_campaigns(client, admin_headers):
    ravi = citizen(client, 1)
    assert client.post("/api/campaigns", json=body(), headers=ravi).status_code == 403
    assert client.post("/api/campaigns", json=body(scope="district", scope_id=1), headers=ravi).status_code == 403
    admin = admin_headers
    assert client.post("/api/campaigns", json=body(), headers=admin).status_code == 201
    assert client.post("/api/campaigns", json=body(scope="district"), headers=admin).status_code == 422


def test_progress_counts_actions_in_scope_and_window(client, admin_headers):
    admin = admin_headers
    client.post("/api/campaigns", json=body(), headers=admin)
    client.post("/api/campaigns", json=body(title="Ahmedabad only", scope="district", scope_id=1), headers=admin)
    a, b = citizen(client, 1, 1), citizen(client, 2, 2)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=a)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=b)
    client.post("/api/actions", data={"action_code": "led_bulb"}, headers=a)  # wrong action: not counted
    mine = {c["title"]: c for c in client.get("/api/campaigns", headers=a).json()}
    assert mine["Cycle to work week"]["progress"] == 2 and mine["Cycle to work week"]["my_count"] == 1
    assert mine["Cycle to work week"]["participants"] == 2 and mine["Cycle to work week"]["status"] == "active"
    assert mine["Ahmedabad only"]["progress"] == 1
    other = {c["title"] for c in client.get("/api/campaigns", headers=b).json()}
    assert other == {"Cycle to work week"}  # the district campaign is not shown outside its district


def test_society_committee_runs_its_own_and_members_cannot(client):
    chair = citizen(client, 1)
    s = client.post("/api/societies", json={"name": "Shanti Apartments"}, headers=chair).json()
    member = citizen(client, 2)
    client.post("/api/societies/join", json={"code": s["join_code"]}, headers=member)
    assert client.post("/api/campaigns", json=body(scope="society"), headers=member).status_code == 403
    made = client.post("/api/campaigns", json=body(scope="society"), headers=chair)
    assert made.status_code == 201 and made.json()["scope_label"] == "Shanti Apartments"
    assert len(client.get("/api/campaigns", headers=member).json()) == 1
    outsider = citizen(client, 3)
    assert client.get("/api/campaigns", headers=outsider).json() == []


def test_dates_are_validated_and_creator_can_delete(client, admin_headers):
    admin = admin_headers
    t = today_ist()
    assert client.post("/api/campaigns", json=body(ends_on=str(t - timedelta(days=1)), starts_on=str(t - timedelta(days=3))), headers=admin).status_code == 422
    assert client.post("/api/campaigns", json=body(ends_on=str(t + timedelta(days=200))), headers=admin).status_code == 422
    made = client.post("/api/campaigns", json=body(), headers=admin).json()
    ravi = citizen(client, 1)
    assert client.delete(f"/api/campaigns/{made['id']}", headers=ravi).status_code == 403
    assert client.delete(f"/api/campaigns/{made['id']}", headers=admin).status_code == 204


def test_certificate_only_after_the_campaign_for_participants(client, admin_headers):
    admin = admin_headers
    made = client.post("/api/campaigns", json=body(), headers=admin).json()
    a = citizen(client, 1)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=a)
    assert client.get(f"/api/campaigns/{made['id']}/certificate.png", headers=a).status_code == 409  # still running


def test_finished_campaign_gives_participants_a_png_certificate(client, admin_headers):
    from app.db import SessionLocal
    from app.models import Campaign

    a = citizen(client, 1)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=a)
    t = today_ist()
    with SessionLocal() as db:
        c = Campaign(title="Past", description="", action_code=None, target=1, starts_on=t - timedelta(days=2),
                     ends_on=t - timedelta(days=1), scope="state", created_by=1)
        db.add(c)
        db.commit()
        cid = c.id
    # the action was logged today, outside that past window, so no certificate
    assert client.get(f"/api/campaigns/{cid}/certificate.png", headers=a).status_code == 409
    with SessionLocal() as db:
        db.get(Campaign, cid).ends_on = t
        db.get(Campaign, cid).starts_on = t - timedelta(days=1)
        db.commit()
    assert client.get(f"/api/campaigns/{cid}/certificate.png", headers=a).status_code == 409  # still running today


def test_certificate_renders_a_png_with_first_name_only():
    from app.services.share_card import render_certificate

    png = render_certificate("Asha", "Cycle week", "All of Gujarat", 3, 40, 30, "01 Nov to 07 Nov 2026")
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
