"""State administrator views: regional conservation analytics and proof review."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.deps import AdminUser, DbSession
from app.models import ActionLog, ActionStatus, ActionType, District, EnergyReading, Household, Role, User
from app.schemas import (
    AdminOverviewOut,
    CategoryStatOut,
    ConsumptionPointOut,
    DistrictDetailOut,
    DistrictStatOut,
    ReviewDecisionIn,
    ReviewItemOut,
    SolarPotentialOut,
    WardStatOut,
    WeeklyPointOut,
)
from app.services import factors, solar
from app.services.gamification import points_for
from app.services.stats import COUNTED_STATUSES
from app.timeutil import IST, as_utc

router = APIRouter(prefix="/api/admin", tags=["admin"])

WEEKS_OF_HISTORY = 8


def _counted():
    return ActionLog.status.in_(COUNTED_STATUSES)


def _weekly(db: Session, now: datetime, district_id: int | None = None) -> list[WeeklyPointOut]:
    """Last N IST weeks of activity, bucketed in Python so the query stays portable across databases."""
    today = now.astimezone(IST).date()
    first_week = today - timedelta(days=today.weekday() + 7 * (WEEKS_OF_HISTORY - 1))
    since = as_utc(datetime.combine(first_week, datetime.min.time(), tzinfo=IST))
    buckets = {
        first_week + timedelta(weeks=i): {"actions": 0, "co2": 0.0, "users": set()} for i in range(WEEKS_OF_HISTORY)
    }
    q = select(ActionLog.created_at, ActionLog.co2_saved_kg, ActionLog.user_id).where(
        _counted(), ActionLog.created_at >= since
    )
    if district_id is not None:
        q = q.join(User, User.id == ActionLog.user_id).where(User.district_id == district_id)
    for created_at, co2, user_id in db.execute(q):
        day = as_utc(created_at).astimezone(IST).date()
        bucket = buckets.get(day - timedelta(days=day.weekday()))
        if bucket:
            bucket["actions"] += 1
            bucket["co2"] += co2
            bucket["users"].add(user_id)
    return [
        WeeklyPointOut(
            week_start=week, actions=b["actions"], co2_saved_kg=round(b["co2"], 1), active_citizens=len(b["users"])
        )
        for week, b in sorted(buckets.items())
    ]


def _categories(db: Session, since: datetime | None = None, district_id: int | None = None) -> list[CategoryStatOut]:
    q = (
        select(
            ActionType.category,
            func.count(ActionLog.id).label("actions"),
            func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0).label("co2"),
        )
        .join(ActionLog, ActionLog.action_type_id == ActionType.id)
        .where(_counted())
        .group_by(ActionType.category)
        .order_by(func.sum(ActionLog.co2_saved_kg).desc())
    )
    if since is not None:
        q = q.where(ActionLog.created_at >= since)
    if district_id is not None:
        q = q.join(User, User.id == ActionLog.user_id).where(User.district_id == district_id)
    return [CategoryStatOut(category=r.category, actions=r.actions, co2_saved_kg=round(float(r.co2), 1)) for r in db.execute(q)]


def _solar_potential(db: Session, district_id: int | None = None) -> dict[int, SolarPotentialOut]:
    """Rooftop potential of registered households that don't have solar yet, by district.

    Sized with the same rules as the citizen calculator (roof area and consumption limits).
    """
    q = select(User.district_id, Household.roof_area_sqm, Household.monthly_kwh, Household.has_solar).join(
        Household, Household.user_id == User.id
    )
    if district_id is not None:
        q = q.where(User.district_id == district_id)
    acc: dict[int, dict] = {}
    for d_id, roof, kwh, has_solar in db.execute(q):
        a = acc.setdefault(d_id, {"roofs": 0, "installed": 0, "kwp": 0.0, "subsidy": 0.0})
        if has_solar:
            a["installed"] += 1
        elif roof:
            kwp, _ = solar.size_system(roof, kwh)
            if kwp > 0:
                a["roofs"] += 1
                a["kwp"] += kwp
                a["subsidy"] += factors.pm_surya_ghar_subsidy(kwp)
    return {
        d_id: SolarPotentialOut(
            suitable_households=a["roofs"],
            installed_households=a["installed"],
            potential_kwp=round(a["kwp"], 1),
            annual_generation_kwh=round(a["kwp"] * factors.DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP),
            annual_co2_avoided_t=round(
                a["kwp"] * factors.DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP * factors.GRID_KG_CO2_PER_KWH / 1000, 1
            ),
            subsidy_pipeline_rs=round(a["subsidy"]),
        )
        for d_id, a in acc.items()
    }


@router.get("/overview", response_model=AdminOverviewOut)
def overview(_: AdminUser, db: DbSession):
    now = datetime.now(timezone.utc)
    since_7d, since_30d = now - timedelta(days=7), now - timedelta(days=30)
    counted = _counted()

    citizens = db.scalar(select(func.count(User.id)).where(User.role == Role.citizen))
    onboarded = db.scalar(select(func.count(Household.user_id)))
    active_7d = db.scalar(
        select(func.count(func.distinct(ActionLog.user_id))).where(ActionLog.created_at >= since_7d)
    )
    actions_total, co2_total, co2_verified, kwh_total = db.execute(
        select(
            func.count(ActionLog.id),
            func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0),
            func.coalesce(
                func.sum(ActionLog.co2_saved_kg).filter(ActionLog.status == ActionStatus.verified), 0.0
            ),
            func.coalesce(func.sum(ActionType.kwh_saved), 0.0),
        )
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(counted)
    ).one()
    pending = db.scalar(select(func.count(ActionLog.id)).where(ActionLog.status == ActionStatus.pending))

    # Per-district stats in a few grouped queries rather than one per district.
    citizens_by_d = dict(
        db.execute(
            select(User.district_id, func.count(User.id)).where(User.role == Role.citizen).group_by(User.district_id)
        ).all()
    )
    baseline_by_d = dict(
        db.execute(
            select(User.district_id, func.avg(Household.baseline_kg_co2_month))
            .join(Household, Household.user_id == User.id)
            .group_by(User.district_id)
        ).all()
    )
    activity_by_d = {
        row.district_id: row
        for row in db.execute(
            select(
                User.district_id,
                func.count(func.distinct(ActionLog.user_id))
                .filter(ActionLog.created_at >= since_7d)
                .label("active"),
                func.count(ActionLog.id).filter(ActionLog.created_at >= since_30d).label("actions"),
                func.coalesce(
                    func.sum(ActionLog.co2_saved_kg).filter(ActionLog.created_at >= since_30d), 0.0
                ).label("co2"),
            )
            .join(User, User.id == ActionLog.user_id)
            .where(counted)
            .group_by(User.district_id)
        ).all()
    }
    solar_by_d = _solar_potential(db)

    districts = []
    for d in db.scalars(select(District).order_by(District.name)).all():
        act = activity_by_d.get(d.id)
        baseline = baseline_by_d.get(d.id)
        n = citizens_by_d.get(d.id, 0)
        co2 = round(float(act.co2), 1) if act else 0.0
        active = act.active if act else 0
        districts.append(
            DistrictStatOut(
                district_id=d.id,
                district=d.name,
                lat=d.lat,
                lon=d.lon,
                citizens=n,
                active_7d=active,
                participation_pct=round(active / n * 100, 1) if n else None,
                actions_30d=act.actions if act else 0,
                co2_saved_30d_kg=co2,
                co2_per_citizen_30d_kg=round(co2 / n, 2) if n else None,
                avg_baseline_kg=round(float(baseline), 1) if baseline is not None else None,
                solar_potential_kwp=solar_by_d[d.id].potential_kwp if d.id in solar_by_d else 0.0,
            )
        )

    return AdminOverviewOut(
        citizens=citizens,
        onboarded=onboarded,
        active_7d=active_7d,
        actions_total=actions_total,
        co2_saved_total_kg=round(float(co2_total), 1),
        co2_verified_total_kg=round(float(co2_verified), 1),
        kwh_saved_total=round(float(kwh_total), 1),
        pending_reviews=pending,
        districts=districts,
        categories=_categories(db),
        weekly=_weekly(db, now),
    )


@router.get("/districts/{district_id}", response_model=DistrictDetailOut)
def district_detail(district_id: int, _: AdminUser, db: DbSession):
    """Everything a district officer needs: engagement, impact, consumption trend, wards and solar pipeline."""
    district = db.get(District, district_id)
    if district is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown district")
    now = datetime.now(timezone.utc)
    since_7d, since_30d = now - timedelta(days=7), now - timedelta(days=30)
    in_district = (User.district_id == district_id) & (User.role == Role.citizen)

    citizens = db.scalar(select(func.count(User.id)).where(in_district))
    onboarded = db.scalar(select(func.count(Household.user_id)).join(User, User.id == Household.user_id).where(in_district))
    active, actions, co2, kwh, peak_shifts = db.execute(
        select(
            func.count(func.distinct(ActionLog.user_id)).filter(ActionLog.created_at >= since_7d),
            func.count(ActionLog.id).filter(ActionLog.created_at >= since_30d),
            func.coalesce(func.sum(ActionLog.co2_saved_kg).filter(ActionLog.created_at >= since_30d), 0.0),
            func.coalesce(func.sum(ActionType.kwh_saved).filter(ActionLog.created_at >= since_30d), 0.0),
            func.count(ActionLog.id).filter(ActionLog.created_at >= since_30d, ActionType.code == "shift_heavy_load"),
        )
        .join(User, User.id == ActionLog.user_id)
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(_counted(), in_district)
    ).one()
    avg_baseline = db.scalar(
        select(func.avg(Household.baseline_kg_co2_month)).join(User, User.id == Household.user_id).where(in_district)
    )
    survey_requests = db.scalar(
        select(func.count(ActionLog.id))
        .join(User, User.id == ActionLog.user_id)
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(_counted(), in_district, ActionType.code == "solar_survey")
    )

    # Average household consumption per month: is the district's electricity use falling?
    six_months_ago = now.astimezone(IST).date().replace(day=1) - timedelta(days=150)
    consumption = [
        ConsumptionPointOut(month=row.month.strftime("%Y-%m"), avg_kwh=round(float(row.avg_kwh), 1), households=row.n)
        for row in db.execute(
            select(
                EnergyReading.month,
                func.avg(EnergyReading.kwh).label("avg_kwh"),
                func.count(EnergyReading.id).label("n"),
            )
            .join(User, User.id == EnergyReading.user_id)
            .where(in_district, EnergyReading.month >= six_months_ago.replace(day=1))
            .group_by(EnergyReading.month)
            .order_by(EnergyReading.month)
        )
    ]

    wards = [
        WardStatOut(ward=row.ward, citizens=row.citizens, co2_saved_30d_kg=round(float(row.co2), 1))
        for row in db.execute(
            select(
                User.ward,
                func.count(func.distinct(User.id)).label("citizens"),
                func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0).label("co2"),
            )
            .outerjoin(ActionLog, (ActionLog.user_id == User.id) & _counted() & (ActionLog.created_at >= since_30d))
            .where(in_district, User.ward.is_not(None))
            .group_by(User.ward)
            .order_by(func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0).desc())
            .limit(5)
        )
    ]

    return DistrictDetailOut(
        district_id=district.id,
        district=district.name,
        citizens=citizens,
        onboarded=onboarded,
        active_7d=active,
        participation_pct=round(active / citizens * 100, 1) if citizens else None,
        actions_30d=actions,
        co2_saved_30d_kg=round(float(co2), 1),
        kwh_saved_30d=round(float(kwh), 1),
        peak_shifts_30d=peak_shifts,
        avg_baseline_kg=round(float(avg_baseline), 1) if avg_baseline is not None else None,
        consumption=consumption,
        categories=_categories(db, since=since_30d, district_id=district_id),
        weekly=_weekly(db, now, district_id),
        top_wards=wards,
        solar=_solar_potential(db, district_id).get(district_id, SolarPotentialOut()),
        solar_survey_requests=survey_requests,
    )


@router.get("/reviews", response_model=list[ReviewItemOut])
def pending_reviews(_: AdminUser, db: DbSession, limit: int = 50):
    logs = db.scalars(
        select(ActionLog)
        .where(ActionLog.status == ActionStatus.pending)
        .order_by(ActionLog.created_at)
        .limit(min(limit, 200))
    ).all()
    return [
        ReviewItemOut(
            id=log.id,
            user_name=log.user.name,
            district=log.user.district.name if log.user.district else None,
            action_title=log.action_type.title,
            note=log.note,
            created_at=log.created_at,
        )
        for log in logs
    ]


def _pending_log(db, log_id: int) -> ActionLog:
    log = db.get(ActionLog, log_id)
    if log is None or log.status != ActionStatus.pending:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No pending review with this id")
    return log


@router.get("/reviews/{log_id}/proof")
def review_proof(log_id: int, _: AdminUser, db: DbSession):
    log = _pending_log(db, log_id)
    path = Path(get_settings().upload_dir) / (log.proof_path or "")
    if not log.proof_path or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proof file missing")
    return FileResponse(path)


@router.post("/reviews/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def decide_review(log_id: int, body: ReviewDecisionIn, _: AdminUser, db: DbSession):
    log = _pending_log(db, log_id)
    log.status = ActionStatus.verified if body.approve else ActionStatus.rejected
    log.points_awarded = points_for(log.action_type.points, log.status, log.is_daily_challenge)
    log.co2_saved_kg = log.action_type.co2_saved_kg if body.approve else 0.0
    log.reviewed_at = datetime.now(timezone.utc)
    db.commit()
