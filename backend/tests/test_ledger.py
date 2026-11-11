"""Impact Ledger: estimated, self-reported, pending and verified impact are always kept apart."""

from conftest import HOUSEHOLD, register
from sqlalchemy import select, update

from app.db import SessionLocal
from app.models import ActionLog, ActionStatus, ActionType
from app.routers.societies import MIN_GROUP_SIZE


def log(client, headers, code: str) -> dict:
    resp = client.post("/api/actions", data={"action_code": code}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def set_status(code: str, status: ActionStatus) -> None:
    with SessionLocal() as db:
        type_id = db.scalar(select(ActionType.id).where(ActionType.code == code))
        db.execute(update(ActionLog).where(ActionLog.action_type_id == type_id).values(status=status))
        db.commit()


def logged_kwh(code: str) -> float:
    with SessionLocal() as db:
        type_id = db.scalar(select(ActionType.id).where(ActionType.code == code))
        return sum(db.scalars(select(ActionLog.kwh_saved).where(ActionLog.action_type_id == type_id)))


def test_ledger_needs_onboarding(client):
    assert client.get("/api/me/ledger", headers=register(client)).status_code == 409


def test_estimated_comes_from_the_plan(client, citizen):
    ledger = client.get("/api/me/ledger", headers=citizen).json()
    plan = client.get("/api/plan", headers=citizen).json()
    est = ledger["by_status"]["estimated"]
    assert est["rs"] == plan["total_rs_month"]
    assert est["co2_kg"] == plan["total_co2_month_kg"]
    assert ledger["by_status"]["verified"] == {"kwh": 0, "co2_kg": 0, "rs": 0, "actions": 0}


def test_rejected_counts_nowhere_and_verified_never_mixes_with_self_reported(client, citizen):
    log(client, citizen, "ac_24")
    log(client, citizen, "geyser_off")
    log(client, citizen, "standby_off")
    set_status("geyser_off", ActionStatus.verified)
    set_status("standby_off", ActionStatus.rejected)

    ledger = client.get("/api/me/ledger", headers=citizen).json()
    s = ledger["by_status"]
    assert s["self_reported"]["actions"] == 1 and s["self_reported"]["kwh"] == round(logged_kwh("ac_24"), 2)
    assert s["verified"]["actions"] == 1 and s["verified"]["kwh"] == round(logged_kwh("geyser_off"), 2)
    assert s["self_reported"]["rs"] > 0 and s["verified"]["rs"] > 0
    assert s["pending"]["actions"] == 0
    energy = ledger["by_theme"]["energy"]
    assert energy["self_reported"]["actions"] == 1 and energy["verified"]["actions"] == 1
    total_logged = sum(ledger["by_status"][k]["actions"] for k in ("self_reported", "pending", "verified"))
    assert total_logged == 2  # the rejected one is nowhere


def test_points_only_actions_show_under_their_theme_with_no_co2(client, citizen):
    log(client, citizen, "cloth_bag")
    plastic = client.get("/api/me/ledger", headers=citizen).json()["by_theme"]["plastic"]
    assert plastic["self_reported"] == {"kwh": 0, "co2_kg": 0, "rs": 0, "actions": 1}


def test_community_ledger_hidden_below_five_members(client):
    chair = register(client, email="m0@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=chair)
    s = client.post("/api/societies", json={"name": "Shanti Apartments"}, headers=chair).json()
    log(client, chair, "ac_24")

    small = client.get(f"/api/communities/{s['id']}/ledger", headers=chair).json()
    assert small["stats_visible"] is False and small["ledger"] is None and small["members"] == 1

    others = []
    for n in range(1, MIN_GROUP_SIZE):
        h = register(client, email=f"m{n}@example.com")
        client.put("/api/household", json=HOUSEHOLD, headers=h)
        client.post("/api/societies/join", json={"code": s["join_code"]}, headers=h)
        others.append(h)
    log(client, others[0], "geyser_off")
    set_status("geyser_off", ActionStatus.verified)

    big = client.get(f"/api/communities/{s['id']}/ledger", headers=others[1]).json()
    assert big["stats_visible"] is True and big["members"] == MIN_GROUP_SIZE
    st = big["ledger"]["by_status"]
    assert st["self_reported"]["actions"] == 1 and st["verified"]["actions"] == 1
    mine = client.get("/api/me/ledger", headers=chair).json()["by_status"]["estimated"]
    assert st["estimated"]["co2_kg"] == round(mine["co2_kg"] * MIN_GROUP_SIZE, 1)


def test_unknown_community_is_404(client, citizen):
    assert client.get("/api/communities/999/ledger", headers=citizen).status_code == 404
