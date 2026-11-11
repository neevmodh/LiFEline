"""GET /api/engine/today: the Action Engine's ranked cards for the signed-in household."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale
from app.models import ActionLog, ActionStatus, ActionType
from app.routers.actions import action_text
from app.schemas import EngineCardOut, EngineOut
from app.services.engine import Candidate, EngineContext, rank
from app.services.gamification import daily_challenge_code
from app.services.green_hours import green_hours
from app.services.impact import action_impact
from app.services.plan import marginal_rate
from app.services.weather import current_temperature
from app.timeutil import as_utc, ist_day_bounds_utc, now_ist

router = APIRouter(prefix="/api/engine", tags=["engine"])
HISTORY_DAYS = 60


@router.get("/today", response_model=EngineOut)
async def engine_today(user: CurrentUser, db: DbSession, locale: RequestLocale):
    household = user.household
    if household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")

    now = now_ist()
    district = user.district
    temp = await current_temperature(district.lat, district.lon) if district else None
    today_w, _ = await green_hours(district.lat, district.lon, now.replace(tzinfo=None)) if district else (None, None)

    types = db.scalars(select(ActionType)).all()
    rate = marginal_rate(household)
    candidates = []
    for t in types:
        impact = action_impact(t.code, household)
        candidates.append(Candidate(code=t.code, theme=t.theme, points=t.points, max_per_day=t.max_per_day,
                                    impact=impact, rs=impact.kwh * rate))

    start, end = ist_day_bounds_utc(now.date())
    counted = (ActionLog.user_id == user.id, ActionLog.status != ActionStatus.rejected)
    done_today = dict(db.execute(
        select(ActionType.code, func.count(ActionLog.id)).join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(*counted, ActionLog.created_at >= start, ActionLog.created_at < end).group_by(ActionType.code)
    ).all())
    last_done = db.execute(
        select(ActionType.code, func.max(ActionLog.created_at)).join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(*counted, ActionLog.created_at >= as_utc(now) - timedelta(days=HISTORY_DAYS)).group_by(ActionType.code)
    ).all()
    days_since = {code: (now.date() - as_utc(at).astimezone(now.tzinfo).date()).days for code, at in last_done}

    ctx = EngineContext(
        now=now, candidates=candidates, challenge_code=daily_challenge_code(now.date(), [t.code for t in types]),
        temperature_c=temp, district=district.name if district else None,
        green_window=(today_w.start_hour, today_w.end_hour) if today_w else None,
        done_today=done_today, days_since_done=days_since,
    )
    cards = []
    for c in rank(ctx, locale):
        title, description = action_text(c.code, locale)
        cards.append(EngineCardOut(title=title, description=description, **c.__dict__))
    return EngineOut(generated_at=now, temperature_c=temp, green_window=ctx.green_window, cards=cards)
