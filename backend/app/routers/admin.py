"""State administrator views: regional conservation analytics and proof review."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from app.config import get_settings
from app.deps import AdminUser, DbSession
from app.models import ActionLog, ActionStatus, ActionType, District, Household, Role, User
from app.schemas import (
    AdminOverviewOut,
    CategoryStatOut,
    DistrictStatOut,
    ReviewDecisionIn,
    ReviewItemOut,
    WeeklyPointOut,
)
from app.services.gamification import points_for
from app.services.stats import COUNTED_STATUSES
from app.timeutil import IST, as_utc

router = APIRouter(prefix="/api/admin", tags=["admin"])

WEEKS_OF_HISTORY = 8


@router.get("/overview", response_model=AdminOverviewOut)
def overview(_: AdminUser, db: DbSession):
    now = datetime.now(timezone.utc)
    since_7d, since_30d = now - timedelta(days=7), now - timedelta(days=30)
    counted = ActionLog.status.in_(COUNTED_STATUSES)

    citizens = db.scalar(select(func.count(User.id)).where(User.role == Role.citizen))
    onboarded = db.scalar(select(func.count(Household.user_id)))
    active_7d = db.scalar(
        select(func.count(func.distinct(ActionLog.user_id))).where(ActionLog.created_at >= since_7d)
    )
    actions_total, co2_total, kwh_total = db.execute(
        select(
            func.count(ActionLog.id),
            func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0),
            func.coalesce(func.sum(ActionType.kwh_saved), 0.0),
        )
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(counted)
    ).one()
    pending = db.scalar(select(func.count(ActionLog.id)).where(ActionLog.status == ActionStatus.pending))

    # Per-district stats in three grouped queries rather than one per district.
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

    districts = []
    for d in db.scalars(select(District).order_by(District.name)).all():
        act = activity_by_d.get(d.id)
        baseline = baseline_by_d.get(d.id)
        districts.append(
            DistrictStatOut(
                district_id=d.id,
                district=d.name,
                lat=d.lat,
                lon=d.lon,
                citizens=citizens_by_d.get(d.id, 0),
                active_7d=act.active if act else 0,
                actions_30d=act.actions if act else 0,
                co2_saved_30d_kg=round(float(act.co2), 1) if act else 0.0,
                avg_baseline_kg=round(float(baseline), 1) if baseline is not None else None,
            )
        )

    categories = [
        CategoryStatOut(category=row.category, actions=row.actions, co2_saved_kg=round(float(row.co2), 1))
        for row in db.execute(
            select(
                ActionType.category,
                func.count(ActionLog.id).label("actions"),
                func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0).label("co2"),
            )
            .join(ActionLog, ActionLog.action_type_id == ActionType.id)
            .where(counted)
            .group_by(ActionType.category)
            .order_by(func.sum(ActionLog.co2_saved_kg).desc())
        ).all()
    ]

    # Weekly trend, bucketed in Python so the query stays portable across SQLite and Postgres.
    today_ist = now.astimezone(IST).date()
    first_week = today_ist - timedelta(days=today_ist.weekday() + 7 * (WEEKS_OF_HISTORY - 1))
    since_weeks = as_utc(datetime.combine(first_week, datetime.min.time(), tzinfo=IST))
    buckets = {
        first_week + timedelta(weeks=i): {"actions": 0, "co2": 0.0, "users": set()}
        for i in range(WEEKS_OF_HISTORY)
    }
    for created_at, co2, user_id in db.execute(
        select(ActionLog.created_at, ActionLog.co2_saved_kg, ActionLog.user_id).where(
            counted, ActionLog.created_at >= since_weeks
        )
    ):
        day = as_utc(created_at).astimezone(IST).date()
        bucket = buckets.get(day - timedelta(days=day.weekday()))
        if bucket:
            bucket["actions"] += 1
            bucket["co2"] += co2
            bucket["users"].add(user_id)

    weekly = [
        WeeklyPointOut(
            week_start=week,
            actions=b["actions"],
            co2_saved_kg=round(b["co2"], 1),
            active_citizens=len(b["users"]),
        )
        for week, b in sorted(buckets.items())
    ]

    return AdminOverviewOut(
        citizens=citizens,
        onboarded=onboarded,
        active_7d=active_7d,
        actions_total=actions_total,
        co2_saved_total_kg=round(float(co2_total), 1),
        kwh_saved_total=round(float(kwh_total), 1),
        pending_reviews=pending,
        districts=districts,
        categories=categories,
        weekly=weekly,
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
