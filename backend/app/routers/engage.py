"""Nudges, leaderboards and the solar calculator."""

from typing import Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale
from app.models import ActionLog, District, EnergyReading, Household, Role, User
from app.schemas import (
    DistrictRankOut,
    NudgeOut,
    NudgesOut,
    Period,
    SolarIn,
    SolarOut,
    UserRankOut,
)
from app.services import solar
from app.services.green_hours import green_hours
from app.services.nudges import NudgeContext, generate_nudges
from app.services.stats import COUNTED_STATUSES, period_start, user_ranking
from app.services.weather import current_temperature
from app.timeutil import now_ist

router = APIRouter(prefix="/api", tags=["engage"])

# Each district aims to cut 10% of its participants' combined monthly baseline footprint.
DISTRICT_GOAL_SHARE = 0.10


@router.get("/nudges", response_model=NudgesOut)
async def nudges(user: CurrentUser, db: DbSession, locale: RequestLocale):
    household = user.household
    if household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")

    now = now_ist()
    temp = await current_temperature(user.district.lat, user.district.lon) if user.district else None
    today_w, tomorrow_w = (
        await green_hours(user.district.lat, user.district.lon, now.replace(tzinfo=None)) if user.district else (None, None)
    )
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
        green_today=(today_w.start_hour, today_w.end_hour) if today_w else None,
        green_tomorrow=(tomorrow_w.start_hour, tomorrow_w.end_hour) if tomorrow_w else None,
    )
    return NudgesOut(
        temperature_c=temp,
        generated_at=now,
        nudges=[
            NudgeOut(
                code=n.code, title=title, body=body, category=n.category, priority=n.priority,
                action_code=n.action_code, tags=n.tags,
            )
            for n in generate_nudges(ctx)
            for title, body in [n.render(locale)]
        ],
    )


@router.get("/leaderboard/users", response_model=list[UserRankOut])
def user_leaderboard(
    user: CurrentUser,
    db: DbSession,
    period: Period = "week",
    scope: Literal["ward", "district", "state"] = "district",
    limit: int = 20,
):
    if scope == "ward" and not user.ward:
        raise HTTPException(status.HTTP_409_CONFLICT, "Add your ward in your profile to see the ward leaderboard")
    district_id = user.district_id if scope in ("ward", "district") else None
    rows = user_ranking(db, period, district_id=district_id, ward=user.ward if scope == "ward" else None)
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
def district_leaderboard(db: DbSession):
    """This month's district standings against a shared Mission LiFE goal."""
    start = period_start("month")
    counted = ActionLog.status.in_(COUNTED_STATUSES) & (ActionLog.created_at >= start)

    impact = dict(
        db.execute(
            select(User.district_id, func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0))
            .join(ActionLog, (ActionLog.user_id == User.id) & counted)
            .group_by(User.district_id)
        ).all()
    )
    rows = db.execute(
        select(
            District.id,
            District.name,
            func.count(Household.user_id).label("participants"),
            func.sum(Household.baseline_kg_co2_month).label("baseline"),
        )
        .join(User, (User.district_id == District.id) & (User.role == Role.citizen))
        .join(Household, Household.user_id == User.id)
        .group_by(District.id)
    ).all()

    standings = []
    for r in rows:
        co2 = float(impact.get(r.id, 0.0))
        goal = float(r.baseline) * DISTRICT_GOAL_SHARE
        standings.append(
            DistrictRankOut(
                rank=0,
                district_id=r.id,
                district=r.name,
                participants=r.participants,
                co2_saved_kg=round(co2, 1),
                co2_saved_per_participant_kg=round(co2 / r.participants, 2),
                monthly_goal_kg=round(goal),
                goal_progress_pct=round(min(co2 / goal * 100, 100), 1) if goal else 0.0,
            )
        )
    # Rank by progress towards the goal so small districts can compete with big cities.
    standings.sort(key=lambda d: (d.goal_progress_pct, d.co2_saved_per_participant_kg), reverse=True)
    for i, d in enumerate(standings):
        d.rank = i + 1
    return standings


@router.post("/solar/estimate", response_model=SolarOut)
async def solar_estimate(body: SolarIn, db: DbSession):
    lat, lon = body.lat, body.lon
    if (lat is None or lon is None) and body.district_id:
        district = db.get(District, body.district_id)
        if district:
            lat, lon = district.lat, district.lon

    specific_yield = await solar.fetch_specific_yield(lat, lon) if lat is not None and lon is not None else None
    result = solar.estimate(body.roof_area_sqm, body.monthly_kwh, specific_yield, body.discom, body.area)
    return SolarOut(**result.__dict__)
