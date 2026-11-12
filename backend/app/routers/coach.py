"""The coach: this week's note (GET /api/coach/weekly) and Ask Nidhi (POST /api/coach/ask)."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale
from app.models import ActionLog, ActionStatus, DistrictSun
from app.ratelimit import ask_limiter
from app.routers.actions import action_text
from app.services import factors
from app.services.ask import answer
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


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=300)

    @field_validator("question")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Ask a question")
        return v


class AskOut(BaseModel):
    answer: str
    topic: str
    action_code: str | None  # an action the app can log in one tap
    action_title: str | None
    written_by_ai: bool  # the app labels it "written by AI from your numbers"


@router.post("/ask", response_model=AskOut)
async def ask(body: AskIn, user: CurrentUser, db: DbSession, locale: RequestLocale):
    """A short answer to the household's own question, using only its own numbers."""
    if user.household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    ask_limiter.check(str(user.id))
    sun = db.get(DistrictSun, user.district_id) if user.district_id else None
    yield_kwh = sun.kwh_per_kwp if sun else factors.DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP
    a = await answer(body.question, user.household, yield_kwh, locale)
    return AskOut(
        answer=a.text,
        topic=a.topic,
        action_code=a.action_code,
        action_title=action_text(a.action_code, locale)[0] if a.action_code else None,
        written_by_ai=a.written_by_ai,
    )
