"""Web Push alerts: tell people at the right moment, even with the app closed.

Two alerts, each at most once a day per device:
- "green": the sunniest hours (services/green_hours.py) are starting now in your district;
- "peak": the evening peak starts in under 30 minutes, so run heavy loads now or after it.

`due_alerts` is pure and tested; `send` wraps pywebpush. A scheduler (GitHub Actions,
every 15 minutes) calls POST /api/internal/push/run.
"""

import json
import logging
from datetime import datetime

from app.services import factors

log = logging.getLogger(__name__)

MAX_PER_DAY = 2


def parse_sent(value: str, today: str) -> set[str]:
    day, _, kinds = value.partition(":")
    return set(filter(None, kinds.split(","))) if day == today else set()


def format_sent(today: str, kinds: set[str]) -> str:
    return f"{today}:{','.join(sorted(kinds))}"


def due_alerts(now: datetime, green_start_hour: int | None, has_heavy_loads: bool, sent: set[str]) -> list[str]:
    """Which alerts to send at local time `now`, given those already sent today."""
    due = []
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
