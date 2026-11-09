"""Weather-adjusted savings: did the household really save, or was it just a cooler month?"""

from collections import defaultdict
from datetime import date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import ClimateMonth, EnergyReading, Role, User
from app.schemas import AdjustedMonthOut, WeatherInsightOut, WeatherModelOut
from app.services.climate import monthly_cdd
from app.services.weather_norm import Point, adjust, choose_model
from app.timeutil import today_ist

router = APIRouter(prefix="/api/insights", tags=["insights"])

HISTORY_MONTHS = 13


def _since() -> date:
    today = today_ist().replace(day=1)
    year, month = divmod(today.year * 12 + today.month - 1 - HISTORY_MONTHS, 12)
    return date(year, month + 1, 1)


@router.get("/weather", response_model=WeatherInsightOut)
async def weather_adjusted(user: CurrentUser, db: DbSession):
    household = user.household
    if household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    if user.district is None:
        return WeatherInsightOut(available=False, reason="Add your district in your profile")

    since = _since()
    rows = db.execute(
        select(EnergyReading.user_id, EnergyReading.month, EnergyReading.kwh, EnergyReading.source, User.district_id)
        .join(User, User.id == EnergyReading.user_id)
        .where(EnergyReading.month >= since, User.role == Role.citizen)
    ).all()

    own_rows = [r for r in rows if r.user_id == user.id]
    cdd = await monthly_cdd(db, user.district, sorted({r.month for r in rows if r.district_id == user.district_id}))
    if not own_rows or not any(r.month in cdd for r in own_rows):
        return WeatherInsightOut(available=False, reason="Weather data for your bills isn't available yet")

    # Other districts' weather comes only from the cache: no extra API calls per request.
    other_cdd = {
        (c.district_id, c.month): c.cooling_degree_days
        for c in db.scalars(select(ClimateMonth).where(ClimateMonth.month >= since))
    }
    by_user: dict[int, list[Point]] = defaultdict(list)
    district_of: dict[int, int | None] = {}
    for r in rows:
        if r.user_id == user.id:
            continue
        c = cdd.get(r.month) if r.district_id == user.district_id else other_cdd.get((r.district_id, r.month))
        if c is not None:
            by_user[r.user_id].append(Point(r.month, r.kwh, c))
            district_of[r.user_id] = r.district_id

    own = [Point(r.month, r.kwh, cdd[r.month]) for r in own_rows if r.month in cdd]
    model = choose_model(
        own,
        [pts for uid, pts in by_user.items() if district_of[uid] == user.district_id],
        list(by_user.values()),
    )

    # The baseline is the household's onboarding answer, in the month it was given.
    onboarding = next((r for r in own_rows if r.source == "onboarding"), None)
    base_month = onboarding.month if onboarding and onboarding.month in cdd else min(p.month for p in own)
    baseline = Point(base_month, household.monthly_kwh, cdd[base_month])

    months = [m for m in adjust(own, baseline, model) if m.month != base_month]
    return WeatherInsightOut(
        available=True,
        baseline_month=base_month.strftime("%Y-%m"),
        baseline_kwh=household.monthly_kwh,
        baseline_cdd=baseline.cdd,
        model=WeatherModelOut(
            slope_kwh_per_cdd=model.slope_kwh_per_cdd, source=model.source, months_used=model.months_used
        ),
        months=[
            AdjustedMonthOut(
                month=m.month.strftime("%Y-%m"),
                kwh=m.kwh,
                cooling_degree_days=m.cdd,
                expected_kwh=m.expected_kwh,
                saving_pct=m.saving_pct,
                above_expected=m.above_expected,
            )
            for m in months
        ],
    )
