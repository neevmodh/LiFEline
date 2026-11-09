"""Your data, your call: download everything LiFEline holds about you, or erase it.

Deletion is permanent and complete: your account, household, bills, actions, push
devices and every proof photo you uploaded.
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, select

from app.deps import CurrentUser, DbSession
from app.models import (
    ActionLog,
    ActionType,
    EnergyReading,
    Household,
    Notification,
    PushSubscription,
    Role,
    SocietyAnnouncement,
    User,
)
from app.ratelimit import client_ip, login_limiter
from app.routers.societies import remove_member
from app.security import verify_password
from app.storage import get_storage

router = APIRouter(prefix="/api/account", tags=["account"])
log = logging.getLogger(__name__)


class DeleteIn(BaseModel):
    password: str


@router.get("/export")
def export_data(user: CurrentUser, db: DbSession):
    """Everything stored about the signed-in citizen, as a JSON file. Never includes the password hash."""
    h = user.household
    readings = db.scalars(select(EnergyReading).where(EnergyReading.user_id == user.id).order_by(EnergyReading.month)).all()
    actions = db.execute(
        select(ActionLog, ActionType.code)
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(ActionLog.user_id == user.id)
        .order_by(ActionLog.created_at)
    ).all()
    devices = db.scalar(select(PushSubscription.id).where(PushSubscription.user_id == user.id).limit(1))
    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "about": "Everything LiFEline stores about you. Your password is stored only as a salted hash and is not included.",
        "account": {
            "name": user.name,
            "email": user.email,
            "district": user.district.name if user.district else None,
            "ward": user.ward,
            "joined": user.created_at.isoformat(),
        },
        "household": None
        if h is None
        else {
            c.name: getattr(h, c.name)
            for c in Household.__table__.columns
            if c.name not in ("user_id", "updated_at")
        },
        "bill_readings": [{"month": r.month.isoformat(), "kwh": r.kwh, "source": r.source} for r in readings],
        "actions": [
            {
                "when": a.created_at.isoformat(),
                "action": code,
                "status": a.status.value,
                "points": a.points_awarded,
                "co2_saved_kg": a.co2_saved_kg,
                "kwh_saved": a.kwh_saved,
                "note": a.note,
                "has_photo_proof": a.proof_path is not None,
                "ai_screening": a.ai_verdict,
            }
            for a, code in actions
        ],
        "alerts_enabled_on_a_device": devices is not None,
    }
    body = json.dumps(data, ensure_ascii=False, indent=2)
    filename = f"lifeline-my-data-{datetime.now(timezone.utc):%Y%m%d}.json"
    return Response(body, media_type="application/json", headers={
        "Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "private, no-store"})


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(body: DeleteIn, user: CurrentUser, db: DbSession, request: Request):
    """Permanently erase the account and everything attached to it. Needs the password."""
    if user.role != Role.citizen:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "GEDA staff accounts are removed by the state team, not here")
    login_limiter.check(f"{client_ip(request)}:delete:{user.id}")  # a stolen session can't guess the password
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That password isn't right")

    photos = db.scalars(
        select(ActionLog.proof_path).where(ActionLog.user_id == user.id, ActionLog.proof_path.is_not(None))
    ).all()
    storage = get_storage()
    failed = 0
    for name in photos:
        try:
            await storage.delete(name)
        except Exception:  # noqa: BLE001  (best effort per photo; the database rows are removed regardless)
            failed += 1
    if failed:
        log.warning("Account %s deleted but %s proof photo(s) could not be removed from storage", user.id, failed)

    if user.society_member:
        remove_member(db, user.society_member)
    db.execute(delete(SocietyAnnouncement).where(SocietyAnnouncement.author_id == user.id))
    for model in (Notification, PushSubscription, ActionLog, EnergyReading, Household):
        db.execute(delete(model).where(model.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()
