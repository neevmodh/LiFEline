"""GET /api/coach/weekly: this week's note for the signed-in household."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale
from app.models import ActionLog, ActionStatus
from app.services.coach import weekly_note
from app.services.plan import marginal_rate
from app.services.stats import COUNTED_STATUSES
from app.timeutil import IST, as_utc, now_ist

router = APIRouter(prefix="/api/coach", tags=["coach"])


class CoachOut(BaseModel):
    text: str
    written_by_ai: bool  # the app labels it "written by AI from your numbers"
    facts: dict[str, float | int]  # the only numbers the note may use


@router.get("/weekly", response_model=CoachOut)
async def weekly(user: CurrentUser, db: DbSession, locale: RequestLocale):
    if user.household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    since = as_utc(now_ist() - timedelta(days=7))
    rows = db.execute(
        select(ActionLog.created_at, ActionLog.status, ActionLog.co2_saved_kg, ActionLog.kwh_saved)
        .where(ActionLog.user_id == user.id, ActionLog.status.in_(COUNTED_STATUSES), ActionLog.created_at >= since)
    ).all()
    kwh = sum(r.kwh_saved for r in rows)
    facts: dict[str, float | int] = {
        "actions": len(rows),
        "verified": sum(1 for r in rows if r.status == ActionStatus.verified),
        "active_days": len({as_utc(r.created_at).astimezone(IST).date() for r in rows}),
        "co2_kg": round(sum(r.co2_saved_kg for r in rows), 1),
        "kwh": round(kwh, 1),
        "rs": round(kwh * marginal_rate(user.household)),
    }

    text, by_ai = await weekly_note(facts, locale)
    return CoachOut(text=text, written_by_ai=by_ai, facts=facts)
