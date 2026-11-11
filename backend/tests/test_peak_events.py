"""Peak Hour Challenge: a one-day GEDA event with an hour window; only heavy-load shifts inside it count."""

from datetime import datetime, time, timedelta

import pytest
from conftest import HOUSEHOLD, register
from sqlalchemy import update

from app.db import SessionLocal
from app.models import ActionLog
from app.routers import push as push_router
from app.services import push
from app.timeutil import IST, as_utc, today_ist


def peak(**kw):
    t = today_ist()
    base = {"title": "Diwali evening peak", "target": 10, "starts_on": str(t), "ends_on": str(t),
            "scope": "state", "kind": "peak", "start_hour": 18, "end_hour": 20}
    return {**base, **kw}


def citizen(client, n):
    h = register(client, email=f"p{n}@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    return h


def test_peak_events_are_geda_only_one_day_with_a_window(client, admin_headers):
    assert client.post("/api/campaigns", json=peak(), headers=citizen(client, 1)).status_code == 403
    t = today_ist()
    assert client.post("/api/campaigns", json=peak(ends_on=str(t + timedelta(days=1))), headers=admin_headers).status_code == 422
    assert client.post("/api/campaigns", json=peak(start_hour=20, end_hour=18), headers=admin_headers).status_code == 422
    assert client.post("/api/campaigns", json=peak(start_hour=None), headers=admin_headers).status_code == 422
    made = client.post("/api/campaigns", json=peak(action_code="cycle_walk"), headers=admin_headers).json()
    assert made["kind"] == "peak" and made["action_title"] == "Ran a heavy appliance off-peak"  # always shift_heavy_load
    assert (made["start_hour"], made["end_hour"]) == (18, 20)


def test_only_shifts_logged_inside_the_window_count(client, admin_headers):
    client.post("/api/campaigns", json=peak(), headers=admin_headers)
    a = citizen(client, 1)
    for _ in range(2):
        assert client.post("/api/actions", data={"action_code": "shift_heavy_load"}, headers=a).status_code == 201
    day = today_ist()
    inside = as_utc(datetime.combine(day, time(18, 30), tzinfo=IST))
    before = as_utc(datetime.combine(day, time(17, 30), tzinfo=IST))
    with SessionLocal() as db:
        ids = [log.id for log in db.query(ActionLog).order_by(ActionLog.id)]
        db.execute(update(ActionLog).where(ActionLog.id == ids[0]).values(created_at=inside))
        db.execute(update(ActionLog).where(ActionLog.id == ids[1]).values(created_at=before))
        db.commit()
    event = client.get("/api/campaigns", headers=a).json()[0]
    assert event["progress"] == 1 and event["my_count"] == 1


def test_live_flag_follows_the_window(client, admin_headers, monkeypatch):
    from app.routers import campaigns

    client.post("/api/campaigns", json=peak(), headers=admin_headers)
    a = citizen(client, 1)
    day = today_ist()
    monkeypatch.setattr(campaigns, "now_ist", lambda: datetime.combine(day, time(18, 15), tzinfo=IST))
    assert client.get("/api/campaigns", headers=a).json()[0]["live"] is True
    monkeypatch.setattr(campaigns, "now_ist", lambda: datetime.combine(day, time(20, 0), tzinfo=IST))
    assert client.get("/api/campaigns", headers=a).json()[0]["live"] is False


def test_event_reminder_is_due_30_minutes_before_the_window():
    day = datetime(2026, 11, 12, 17, 30)
    assert push.due_alerts(day, None, False, set(), event_start_hour=18) == ["event"]
    assert push.due_alerts(day.replace(minute=10), None, False, set(), event_start_hour=18) == []
    assert push.due_alerts(day, None, False, {"event"}, event_start_hour=18) == []


@pytest.fixture()
def sender(monkeypatch):
    s = push_router.get_settings()
    monkeypatch.setattr(s, "push_cron_secret", "cron-secret")
    monkeypatch.setattr(s, "vapid_private_key", "")
    sent = []
    monkeypatch.setattr(push, "send_expo", lambda token, payload: sent.append(payload))

    async def no_window(lat, lon, now):
        return None

    monkeypatch.setattr(push_router, "window_from_now", no_window)
    return sent


def test_scheduler_sends_the_event_reminder(client, admin_headers, sender, monkeypatch):
    client.post("/api/campaigns", json=peak(start_hour=19, end_hour=21), headers=admin_headers)
    a = citizen(client, 1)
    client.post("/api/push/expo", json={"token": "ExponentPushToken[abc]"}, headers={**a, "Accept-Language": "en"})
    day = today_ist()
    monkeypatch.setattr(push_router, "now_ist", lambda: datetime.combine(day, time(18, 35), tzinfo=IST))
    assert client.post("/api/internal/push/run", headers={"X-Cron-Secret": "cron-secret"}).json()["sent"] == 1
    assert "Diwali evening peak" in sender[0]["title"] and sender[0]["tag"] == "nidhi-event"
