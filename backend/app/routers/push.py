"""Web Push: subscribe a device, and the scheduled sender for Green Hours and peak alerts."""

import asyncio
import hmac
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale, tr
from app.models import District, EnergyReading, Household, PushSubscription, User
from app.services import push
from app.services.factors import peak_label
from app.services.green_hours import window_from_now
from app.timeutil import now_ist

router = APIRouter(tags=["push"])


class Keys(BaseModel):
    p256dh: str = Field(max_length=200)
    auth: str = Field(max_length=100)


class SubscriptionIn(BaseModel):
    endpoint: str = Field(max_length=1000, pattern=r"^https://")
    keys: Keys


class UnsubscribeIn(BaseModel):
    endpoint: str = Field(max_length=1000)


@router.get("/api/push/key")
def public_key():
    """The VAPID public key browsers need to subscribe; null when alerts aren't set up."""
    return {"public_key": get_settings().vapid_public_key or None}


@router.post("/api/push/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def subscribe(body: SubscriptionIn, user: CurrentUser, db: DbSession, locale: RequestLocale):
    sub = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))
    if sub is None:
        sub = PushSubscription(endpoint=body.endpoint, sent_today="")
        db.add(sub)
    sub.user_id, sub.p256dh, sub.auth, sub.locale = user.id, body.keys.p256dh, body.keys.auth, locale
    db.commit()


@router.delete("/api/push/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(body: UnsubscribeIn, user: CurrentUser, db: DbSession):
    db.execute(delete(PushSubscription).where(PushSubscription.endpoint == body.endpoint,
                                              PushSubscription.user_id == user.id))
    db.commit()


@router.post("/api/internal/push/run")
async def run_alerts(db: DbSession, x_cron_secret: Annotated[str | None, Header()] = None):
    """Send any alerts that are due now. Called every 15 minutes by the scheduler."""
    s = get_settings()
    if not (s.push_cron_secret and s.vapid_private_key):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Push alerts are not configured")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, s.push_cron_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad scheduler secret")

    now = now_ist()
    today = now.date().isoformat()
    rows = db.execute(
        select(PushSubscription, Household, District)
        .join(User, User.id == PushSubscription.user_id)
        .join(Household, Household.user_id == User.id)
        .join(District, District.id == User.district_id)
    ).all()

    this_month = now.date().replace(day=1)
    have_reading = set(db.scalars(select(EnergyReading.user_id).where(EnergyReading.month == this_month)))
    windows: dict[int, int | None] = {}  # one forecast per district per run
    sent = removed = 0
    for sub, household, district in rows:
        if district.id not in windows:
            w = await window_from_now(district.lat, district.lon, now.replace(tzinfo=None))
            windows[district.id] = w.start_hour if w else None
        heavy = household.has_washing_machine or household.has_geyser or household.has_ev
        done = push.parse_sent(sub.sent_today, today)
        for kind in push.due_alerts(now, windows[district.id], heavy, done, sub.user_id not in have_reading):
            payload = {
                "title": tr(sub.locale, f"push.{kind}.title", district=district.name),
                "body": tr(sub.locale, f"push.{kind}.body", peak=peak_label()),
                "url": "/dashboard",
                "tag": f"nidhi-{kind}",
            }
            try:
                await asyncio.to_thread(push.send, sub.endpoint, sub.p256dh, sub.auth, payload,
                                        s.vapid_private_key, s.vapid_subject)
            except push.Gone:
                db.delete(sub)
                removed += 1
                break
            done.add(kind)
            sub.sent_today = push.format_sent(today, done)
            sent += 1
    db.commit()
    return {"subscriptions": len(rows), "sent": sent, "removed": removed}

