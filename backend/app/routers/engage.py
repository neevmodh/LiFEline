"""Nudges, leaderboards and the solar calculator."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import ActionLog, District, EnergyReading, Role, User
from app.schemas import DistrictRankOut, NudgeOut, NudgesOut, Period, SolarIn, SolarOut, UserRankOut
from app.services import solar
from app.services.nudges import NudgeContext, generate_nudges
from app.services.stats import COUNTED_STATUSES, period_start, user_ranking
from app.services.weather import current_temperature
from app.timeutil import now_ist

router = APIRouter(prefix="/api", tags=["engage"])


@router.get("/nudges", response_model=NudgesOut)
async def nudges(user: CurrentUser, db: DbSession):
    household = user.household
    if household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")

    now = now_ist()
    temp = await current_temperature(user.district.lat, user.district.lon) if user.district else None
    current = db.scalar(
        select(EnergyReading.kwh).where(
            EnergyReading.user_id == user.id,
            EnergyReading.month == now.date().replace(day=1),
            EnergyReading.source != "onboarding",
        )
    )
    ctx = NudgeContext(
        now=now,
        ac_count=household.ac_count,
        has_geyser=household.has_geyser,
        has_washing_machine=household.has_washing_machine,
        has_ev=household.has_ev,
        has_solar=household.has_solar,
        commute_mode=household.commute_mode,
        commute_km_per_day=household.commute_km_per_day,
        baseline_kwh=household.monthly_kwh,
        current_month_kwh=current,
        temperature_c=temp,
    )
    return NudgesOut(
        temperature_c=temp,
        generated_at=now,
        nudges=[NudgeOut(**n.__dict__) for n in generate_nudges(ctx)],
    )


@router.get("/leaderboard/users", response_model=list[UserRankOut])
def user_leaderboard(
    user: CurrentUser,
    db: DbSession,
    period: Period = "week",
    scope: str = "district",
    limit: int = 20,
):
    district_id = user.district_id if scope == "district" else None
    rows = user_ranking(db, period, district_id=district_id)
    districts = dict(db.execute(select(District.id, District.name)).all())

    ranked = [
        UserRankOut(
            rank=i + 1,
            user_id=row.id,
            name=row.name,
            district=districts.get(row.district_id),
            ward=row.ward,
            points=int(row.points),
            co2_saved_kg=round(float(row.co2), 1),
            is_me=row.id == user.id,
        )
        for i, row in enumerate(rows)
    ]
    top = ranked[: min(limit, 100)]
    # Always show the caller's own position, even outside the top N.
    if not any(r.is_me for r in top):
        top.extend(r for r in ranked if r.is_me)
    return top


@router.get("/leaderboard/districts", response_model=list[DistrictRankOut])
def district_leaderboard(db: DbSession, period: Period = "month"):
    join_cond = (ActionLog.user_id == User.id) & ActionLog.status.in_(COUNTED_STATUSES)
    start = period_start(period)
    if start is not None:
        join_cond = join_cond & (ActionLog.created_at >= start)

    co2 = func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0)
    rows = db.execute(
        select(
            District.id,
            District.name,
            District.monthly_goal_kg,
            func.count(func.distinct(User.id)).label("participants"),
            co2.label("co2"),
        )
        .join(User, (User.district_id == District.id) & (User.role == Role.citizen))
        .outerjoin(ActionLog, join_cond)
        .group_by(District.id)
    ).all()

    results = sorted(
        (
            (r, float(r.co2) / r.participants if r.participants else 0.0)
            for r in rows
        ),
        # Rank by impact per participant so small districts can compete with big cities.
        key=lambda pair: pair[1],
        reverse=True,
    )
    return [
        DistrictRankOut(
            rank=i + 1,
            district_id=r.id,
            district=r.name,
            participants=r.participants,
            co2_saved_kg=round(float(r.co2), 1),
            co2_saved_per_participant_kg=round(per_capita, 2),
            monthly_goal_kg=r.monthly_goal_kg,
            goal_progress_pct=round(min(float(r.co2) / r.monthly_goal_kg * 100, 100), 1)
            if r.monthly_goal_kg
            else 0.0,
        )
        for i, (r, per_capita) in enumerate(results)
    ]


@router.post("/solar/estimate", response_model=SolarOut)
async def solar_estimate(body: SolarIn, db: DbSession):
    lat, lon = body.lat, body.lon
    if (lat is None or lon is None) and body.district_id:
        district = db.get(District, body.district_id)
        if district:
            lat, lon = district.lat, district.lon

    specific_yield = await solar.fetch_specific_yield(lat, lon) if lat is not None and lon is not None else None
    result = solar.estimate(body.roof_area_sqm, body.monthly_kwh, specific_yield)
    return SolarOut(**result.__dict__)
