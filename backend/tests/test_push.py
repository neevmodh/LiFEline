"""Web Push alerts: when they're due, who gets them, and that the sender is locked down."""

from datetime import datetime

import pytest

from app.routers import push as push_router
from app.services import push
from app.services.green_hours import Window
from app.services.push import due_alerts, format_sent, parse_sent

SUB = {"endpoint": "https://push.example.com/abc", "keys": {"p256dh": "k" * 40, "auth": "a" * 16}}


def test_green_alert_fires_in_the_window_start_hour_only():
    assert due_alerts(datetime(2026, 11, 10, 11, 5), 11, True, set()) == ["green"]
    assert due_alerts(datetime(2026, 11, 10, 10, 50), 11, True, set()) == []
    assert due_alerts(datetime(2026, 11, 10, 11, 5), 11, False, set()) == []  # no heavy appliances


def test_peak_alert_in_the_half_hour_before_peak():
    assert due_alerts(datetime(2026, 11, 10, 17, 30), None, True, set()) == ["peak"]
    assert due_alerts(datetime(2026, 11, 10, 17, 10), None, True, set()) == []


def test_each_alert_once_a_day_and_at_most_two():
    assert due_alerts(datetime(2026, 11, 10, 17, 45), None, True, {"peak"}) == []
    assert due_alerts(datetime(2026, 11, 10, 17, 45), 17, True, {"x", "y"}) == []
    assert parse_sent(format_sent("2026-11-10", {"green"}), "2026-11-10") == {"green"}
    assert parse_sent(format_sent("2026-11-09", {"green"}), "2026-11-10") == set()  # new day resets


@pytest.fixture()
def configured(monkeypatch):
    s = push_router.get_settings()
    monkeypatch.setattr(s, "vapid_private_key", "private")
    monkeypatch.setattr(s, "push_cron_secret", "cron-secret")
    sent = []

    def fake_send(endpoint, p256dh, auth, payload, key, subject):
        if endpoint.endswith("gone"):
            raise push.Gone()
        sent.append((endpoint, payload))

    monkeypatch.setattr(push, "send", fake_send)
    return sent


def _run(client, monkeypatch, hour, minute, green_start=None):
    async def fake_window(lat, lon, now):
        return Window(now.date(), green_start, green_start + 3, 700, "sunny") if green_start is not None else None

    monkeypatch.setattr(push_router, "window_from_now", fake_window)
    monkeypatch.setattr(push_router, "now_ist", lambda: datetime(2026, 11, 10, hour, minute))
    return client.post("/api/internal/push/run", headers={"X-Cron-Secret": "cron-secret"})


def test_sender_sends_due_alerts_once_in_the_users_language(client, citizen, configured, monkeypatch):
    client.post("/api/push/subscribe", json=SUB, headers={**citizen, "Accept-Language": "en"})
    first = _run(client, monkeypatch, 11, 0, green_start=11).json()
    assert first["sent"] == 1 and configured[0][1]["title"] == "Green Hours start now in Ahmedabad"
    assert _run(client, monkeypatch, 11, 15, green_start=11).json()["sent"] == 0  # already sent today
    peak = _run(client, monkeypatch, 17, 40).json()
    assert peak["sent"] == 1 and "6-10 PM" in configured[-1][1]["body"]


def test_expired_subscriptions_are_removed(client, citizen, configured, monkeypatch):
    client.post("/api/push/subscribe", json={**SUB, "endpoint": "https://push.example.com/gone"}, headers=citizen)
    assert _run(client, monkeypatch, 17, 40).json()["removed"] == 1
    assert _run(client, monkeypatch, 17, 45).json()["subscriptions"] == 0


def test_sender_needs_the_scheduler_secret(client, configured):
    assert client.post("/api/internal/push/run").status_code == 401
    assert client.post("/api/internal/push/run", headers={"X-Cron-Secret": "wrong"}).status_code == 401


def test_sender_is_off_until_configured(client):
    assert client.post("/api/internal/push/run", headers={"X-Cron-Secret": "x"}).status_code == 503
    assert client.get("/api/push/key").json() == {"public_key": None}


def test_subscribe_requires_login_and_https(client, citizen):
    assert client.post("/api/push/subscribe", json=SUB).status_code == 401
    bad = {**SUB, "endpoint": "http://insecure.example.com"}
    assert client.post("/api/push/subscribe", json=bad, headers=citizen).status_code == 422
    assert client.post("/api/push/subscribe", json=SUB, headers=citizen).status_code == 204
    assert client.request("DELETE", "/api/push/subscribe", json={"endpoint": SUB["endpoint"]}, headers=citizen).status_code == 204
