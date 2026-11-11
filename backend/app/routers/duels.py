"""Duels: one community challenges another to 30 days of saving, head to head.

The metric is CO2 avoided per household from the moment the duel is accepted, and it only counts
once at least PARTICIPATION_FLOOR of a community's households have logged an action in the duel,
so a few keen households can't carry a community that isn't taking part. Only committees start,
accept or decline a duel.
"""

import math
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select

from app.deps import CurrentUser, DbSession
from app.models import ActionLog, Duel, Society, SocietyMember
from app.schemas import DuelIn, DuelOut, DuelSideOut
from app.services.stats import COUNTED_STATUSES
from app.timeutil import as_utc, now_ist

router = APIRouter(prefix="/api/duels", tags=["duels"])

DUEL_DAYS = 30
PARTICIPATION_FLOOR = 0.4


def _committee_society(user) -> int:
    m = user.society_member
    if m is None or m.role != "committee":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a community's committee can do this")
    return m.society_id


def _side(db, society: Society, duel: Duel) -> DuelSideOut:
    member_ids = list(db.scalars(select(SocietyMember.user_id).where(SocietyMember.society_id == society.id)))
    members = len(member_ids)
    active, co2 = 0, 0.0
    if duel.starts_at and member_ids:
        window = (
            ActionLog.user_id.in_(member_ids),
            ActionLog.status.in_(COUNTED_STATUSES),
            ActionLog.created_at >= duel.starts_at,
            ActionLog.created_at < duel.ends_at,
        )
        active = db.scalar(select(func.count(func.distinct(ActionLog.user_id))).where(*window)) or 0
        co2 = db.scalar(select(func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0)).where(*window)) or 0.0
    share = active / members if members else 0.0
    counts = members > 0 and share >= PARTICIPATION_FLOOR
    return DuelSideOut(
        society_id=society.id, name=society.name, kind=society.kind, members=members, active_members=active,
        participation_pct=round(share * 100, 1), counts=counts,
        co2_per_member_kg=round(co2 / members, 2) if counts else None,
    )


def _out(db, duel: Duel, my_society_id: int) -> DuelOut:
    mine_is_challenger = duel.challenger_id == my_society_id
    us = _side(db, duel.challenger if mine_is_challenger else duel.opponent, duel)
    them = _side(db, duel.opponent if mine_is_challenger else duel.challenger, duel)

    state = duel.status
    days_left = None
    if duel.status == "active" and duel.ends_at:
        now = now_ist()
        if now >= as_utc(duel.ends_at):
            state, days_left = "finished", 0
        else:
            days_left = math.ceil((as_utc(duel.ends_at) - now).total_seconds() / 86400)

    leader = None
    if us.counts and them.counts:
        a, b = us.co2_per_member_kg or 0, them.co2_per_member_kg or 0
        leader = "tie" if a == b else ("us" if a > b else "them")
    elif us.counts or them.counts:
        leader = "us" if us.counts else "them"
    return DuelOut(
        id=duel.id, status=state, incoming=duel.status == "pending" and not mine_is_challenger,
        starts_at=duel.starts_at, ends_at=duel.ends_at, days_left=days_left, us=us, them=them, leader=leader,
        participation_floor_pct=round(PARTICIPATION_FLOOR * 100),
    )


@router.post("", response_model=DuelOut, status_code=status.HTTP_201_CREATED)
def challenge(body: DuelIn, user: CurrentUser, db: DbSession):
    mine = _committee_society(user)
    if body.opponent_id == mine:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A community can't duel itself")
    if db.get(Society, body.opponent_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Community not found")
    pair = or_(
        (Duel.challenger_id == mine) & (Duel.opponent_id == body.opponent_id),
        (Duel.challenger_id == body.opponent_id) & (Duel.opponent_id == mine),
    )
    open_ = db.scalars(select(Duel).where(pair, Duel.status.in_(("pending", "active")))).all()
    if any(d.status == "pending" or (d.ends_at and as_utc(d.ends_at) > now_ist()) for d in open_):
        raise HTTPException(status.HTTP_409_CONFLICT, "These two communities already have a duel open")
    duel = Duel(challenger_id=mine, opponent_id=body.opponent_id, status="pending", created_by=user.id)
    db.add(duel)
    db.commit()
    db.refresh(duel)
    return _out(db, duel, mine)


def _incoming(db, user, duel_id: int) -> tuple[Duel, int]:
    mine = _committee_society(user)
    duel = db.get(Duel, duel_id)
    if duel is None or mine not in (duel.challenger_id, duel.opponent_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Duel not found")
    if duel.opponent_id != mine:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the challenged community's committee can answer")
    if duel.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "This duel has already been answered")
    return duel, mine


@router.post("/{duel_id}/accept", response_model=DuelOut)
def accept(duel_id: int, user: CurrentUser, db: DbSession):
    duel, mine = _incoming(db, user, duel_id)
    start = as_utc(now_ist())  # stored in UTC like every other timestamp, so window comparisons line up
    duel.status, duel.starts_at, duel.ends_at = "active", start, start + timedelta(days=DUEL_DAYS)
    db.commit()
    return _out(db, duel, mine)


@router.post("/{duel_id}/decline", response_model=DuelOut)
def decline(duel_id: int, user: CurrentUser, db: DbSession):
    duel, mine = _incoming(db, user, duel_id)
    duel.status = "declined"
    db.commit()
    return _out(db, duel, mine)


@router.get("/mine", response_model=list[DuelOut])
def my_duels(user: CurrentUser, db: DbSession):
    """My community's duels, open ones first, newest first. Every member can see them."""
    m = user.society_member
    if m is None:
        return []
    duels = db.scalars(
        select(Duel)
        .where(or_(Duel.challenger_id == m.society_id, Duel.opponent_id == m.society_id), Duel.status != "declined")
        .order_by(Duel.created_at.desc())
    ).all()
    out = [_out(db, d, m.society_id) for d in duels]
    order = {"active": 0, "pending": 1, "finished": 2, "declined": 3}
    return sorted(out, key=lambda d: order[d.status])
