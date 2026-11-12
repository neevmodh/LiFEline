"""A household's own goal, readings proven by a bill photo, month-over-month nudges and the best streak."""

from datetime import datetime, timedelta

import pytest

from app.routers import household as household_router
from app.services.nudges import NudgeContext, generate_nudges
from app.timeutil import now_ist


def test_set_and_clear_a_goal(client, citizen):
    assert client.get("/api/household", headers=citizen).json()["household"]["goal_pct"] is None
    r = client.put("/api/household/goal", json={"pct": 15}, headers=citizen)
    assert r.status_code == 200 and r.json()["goal_pct"] == 15
    assert client.get("/api/household", headers=citizen).json()["household"]["goal_pct"] == 15
    for bad in (4, 51, -10, "lots"):
        assert client.put("/api/household/goal", json={"pct": bad}, headers=citizen).status_code == 422
    assert client.put("/api/household/goal", json={"pct": None}, headers=citizen).json()["goal_pct"] is None


def test_goal_needs_a_household_and_sign_in(client):
    from tests.conftest import register

    assert client.put("/api/household/goal", json={"pct": 10}, headers=register(client, "nohome@example.com")).status_code == 409
    assert client.put("/api/household/goal", json={"pct": 10}).status_code == 401


def month(back: int) -> str:
    d = now_ist().date().replace(day=1)
    for _ in range(back):
        d = (d - timedelta(days=1)).replace(day=1)
    return d.strftime("%Y-%m")


def badge(client, headers, code):
    return next(b for b in client.get("/api/badges", headers=headers).json() if b["code"] == code)


def test_a_reading_counts_as_from_a_photo_only_if_the_api_read_that_bill(client, citizen, monkeypatch):
    user_id = client.get("/api/auth/me", headers=citizen).json()["id"]
    # Claimed, but nothing was scanned: saved as typed.
    client.post("/api/readings", json={"month": month(1), "kwh": 250, "from_photo": True}, headers=citizen)
    assert badge(client, citizen, "bill_photo")["earned"] is False
    # The API read a bill of 240 units just now; a different number still doesn't count.
    household_router._recent_scans[user_id] = (240, household_router.time.monotonic())
    client.post("/api/readings", json={"month": month(1), "kwh": 300, "from_photo": True}, headers=citizen)
    assert badge(client, citizen, "bill_photo")["earned"] is False
    # The same units as the bill it read: from a photo.
    client.post("/api/readings", json={"month": month(1), "kwh": 240, "from_photo": True}, headers=citizen)
    assert badge(client, citizen, "bill_photo")["earned"] is True
    # A scan from long ago doesn't count.
    household_router._recent_scans[user_id] = (210, household_router.time.monotonic() - household_router.SCAN_MEMORY_SECONDS - 1)
    assert household_router.scanned_recently(user_id, 210) is False


def ctx(**over):
    base = dict(now=datetime(2026, 11, 12, 10, 0), ac_count=1, has_geyser=True, has_washing_machine=True, has_ev=False,
                has_solar=False, commute_mode="bus", commute_km_per_day=0, baseline_kwh=300)
    base.update(over)
    return NudgeContext(**base)


@pytest.mark.parametrize(("current", "previous", "fires"), [(330, 300, True), (329, 300, False), (250, 300, False), (330, None, False), (330, 0, False)])
def test_usage_rise_nudge(current, previous, fires):
    codes = [n.code for n in generate_nudges(ctx(current_month_kwh=current, previous_month_kwh=previous))]
    assert ("usage_rise" in codes) is fires


def test_usage_rise_reads_in_every_language():
    nudge = next(n for n in generate_nudges(ctx(current_month_kwh=360, previous_month_kwh=300)) if n.code == "usage_rise")
    for locale in ("en", "gu", "hi"):
        title, body = nudge.render(locale)
        assert "20" in title and "60" in body and "{" not in title + body


def test_best_streak_is_reported(client, citizen):
    client.post("/api/actions", data={"action_code": "standby_off"}, headers=citizen)
    d = client.get("/api/dashboard", headers=citizen).json()
    assert d["best_streak_days"] >= d["streak_days"] >= 1
