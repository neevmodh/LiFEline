"""Web Push alerts: tell people at the right moment, even with the app closed.

Four alerts, each at most once a day per device (and at most two a day in all):
- "green": the sunniest hours (services/green_hours.py) are starting now in your district;
- "peak": the evening peak starts in under 30 minutes, so run heavy loads now or after it;
- "bill": on the 5th, a nudge to log the month's electricity bill if nothing is logged this month;
- "event": a GEDA Peak Hour Challenge starts in under 30 minutes.

`due_alerts` is pure and tested; `send` wraps pywebpush for browsers and `send_expo` calls
the Expo push API for the phone app. A scheduler (GitHub Actions, every 15 minutes) calls
POST /api/internal/push/run.
"""

import json
import logging
from datetime import datetime

import httpx

from app.services import factors

log = logging.getLogger(__name__)

MAX_PER_DAY = 2
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BILL_DAY = 5
BILL_HOUR = 9


def parse_sent(value: str, today: str) -> set[str]:
    day, _, kinds = value.partition(":")
    return set(filter(None, kinds.split(","))) if day == today else set()


def format_sent(today: str, kinds: set[str]) -> str:
    return f"{today}:{','.join(sorted(kinds))}"


def due_alerts(
    now: datetime,
    green_start_hour: int | None,
    has_heavy_loads: bool,
    sent: set[str],
    bill_missing: bool = False,
    event_start_hour: int | None = None,
) -> list[str]:
    """Which alerts to send at local time `now`, given those already sent today.

    `event_start_hour`: a Peak Hour Challenge today; its reminder goes 30 minutes before it starts.
    """
    due = []
    if bill_missing and now.day == BILL_DAY and now.hour == BILL_HOUR:
        due.append("bill")
    if event_start_hour is not None and now.hour == event_start_hour - 1 and now.minute >= 30:
        due.append("event")
    if has_heavy_loads and green_start_hour is not None and now.hour == green_start_hour:
        due.append("green")
    peak_start = factors.PEAK_HOURS[0]
    if has_heavy_loads and now.hour == peak_start - 1 and now.minute >= 30:
        due.append("peak")
    room = MAX_PER_DAY - len(sent)
    return [k for k in due if k not in sent][: max(room, 0)]


class Gone(Exception):
    """The browser unsubscribed or the subscription expired; delete it."""


def send(endpoint: str, p256dh: str, auth: str, payload: dict, private_key: str, subject: str) -> None:
    from pywebpush import WebPushException, webpush  # noqa: PLC0415  (only needed when sending)

    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
            ttl=60 * 60,
        )
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            raise Gone from exc
        log.warning("Push failed (%s): %s", status, exc)


def send_expo(token: str, payload: dict) -> None:
    """Send one alert to the phone app; raise Gone when Expo says the device is no longer registered."""
    try:
        resp = httpx.post(
            EXPO_PUSH_URL,
            json={"to": token, "title": payload["title"], "body": payload["body"], "sound": "default",
                  "data": {"url": payload["url"], "tag": payload["tag"]}},
            headers={"Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        ticket = (resp.json().get("data") or [{}])[0]
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Expo push failed: %s", exc)
        return
    if ticket.get("status") == "error":
        if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
            raise Gone
        log.warning("Expo push failed: %s", ticket.get("message"))
