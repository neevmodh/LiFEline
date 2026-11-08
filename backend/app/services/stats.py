"""Aggregate queries shared by the dashboard, leaderboards and admin views."""

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ActionLog, ActionStatus, Role, User
from app.timeutil import IST, as_utc, now_ist

# Statuses whose impact counts towards totals.
COUNTED_STATUSES = (ActionStatus.self_reported, ActionStatus.verified)


def period_start(period: str) -> datetime | None:
    now = now_ist()
    if period == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        return None
    return as_utc(start)


def user_totals(db: Session, user_id: int) -> tuple[int, float, float, int]:
    """(points, co2_saved_kg, kwh_saved, actions_logged) over all time."""
    row = db.execute(
        select(
            func.coalesce(func.sum(ActionLog.points_awarded), 0),
            func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0),
            func.coalesce(func.sum(ActionLog.kwh_saved), 0.0),
            func.count(ActionLog.id),
        )
        .where(ActionLog.user_id == user_id, ActionLog.status.in_(COUNTED_STATUSES))
    ).one()
    return int(row[0]), round(float(row[1]), 1), round(float(row[2]), 1), int(row[3])


def streak_days(db: Session, user_id: int, today: date) -> int:
    """Consecutive IST days with at least one counted action, ending today or yesterday."""
    since = as_utc(datetime.combine(today - timedelta(days=60), datetime.min.time(), tzinfo=IST))
    stamps = db.scalars(
        select(ActionLog.created_at).where(
            ActionLog.user_id == user_id,
            ActionLog.status != ActionStatus.rejected,
            ActionLog.created_at >= since,
        )
    ).all()
    days = {as_utc(s).astimezone(IST).date() for s in stamps}

    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def user_ranking(
    db: Session, period: str, district_id: int | None = None, ward: str | None = None, limit: int | None = None
):
    """Rows of (user_id, name, district_id, ward, points, co2) ordered by points."""
    points = func.coalesce(func.sum(ActionLog.points_awarded), 0).label("points")
    co2 = func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0).label("co2")
    join_cond = (ActionLog.user_id == User.id) & ActionLog.status.in_(COUNTED_STATUSES)
    start = period_start(period)
    if start is not None:
        join_cond = join_cond & (ActionLog.created_at >= start)

    q = (
        select(User.id, User.name, User.district_id, User.ward, points, co2)
        .outerjoin(ActionLog, join_cond)
        .where(User.role == Role.citizen)
        .group_by(User.id)
        .order_by(points.desc(), co2.desc(), User.id)
    )
    if district_id is not None:
        q = q.where(User.district_id == district_id)
    if ward is not None:
        q = q.where(func.lower(User.ward) == ward.lower())
    if limit:
        q = q.limit(limit)
    return db.execute(q).all()
