"""Societies: apartment or ward groups with a committee that manages participation.

Joining is opt-in with a code. The committee sees its own society only, and society totals
stay hidden until at least MIN_GROUP_SIZE households have joined, so no household stands out.
"""

import csv
import io
import secrets
from datetime import datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import (
    ActionLog,
    District,
    Society,
    SocietyAnnouncement,
    SocietyMember,
    User,
)
from app.schemas import (
    AnnouncementIn,
    AnnouncementOut,
    SocietyCreateIn,
    SocietyGoalIn,
    SocietyJoinIn,
    SocietyMemberOut,
    SocietyOut,
    SocietyRankOut,
)
from app.services.notify import notify
from app.services.stats import COUNTED_STATUSES, period_start

router = APIRouter(prefix="/api/societies", tags=["societies"])

MIN_GROUP_SIZE = 5
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I to mistype


def _new_code(db) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        if not db.scalar(select(Society.id).where(Society.join_code == code)):
            return code
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Couldn't make a join code. Try again.")


def _membership(user: User) -> SocietyMember:
    m = user.society_member
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You haven't joined a society")
    return m


def _committee(user: User) -> SocietyMember:
    m = _membership(user)
    if m.role != "committee":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the committee can do this")
    return m


def _month_totals(db, society_ids: list[int]) -> dict[int, tuple[float, int]]:
    """Per society: (CO2 avoided, actions) this month by its members."""
    if not society_ids:
        return {}
    start = period_start("month")
    rows = db.execute(
        select(SocietyMember.society_id, func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0), func.count(ActionLog.id))
        .join(ActionLog, ActionLog.user_id == SocietyMember.user_id)
        .where(SocietyMember.society_id.in_(society_ids), ActionLog.status.in_(COUNTED_STATUSES),
               ActionLog.created_at >= start)
        .group_by(SocietyMember.society_id)
    ).all()
    return {sid: (float(co2), int(n)) for sid, co2, n in rows}


def _ranking(db, district_id: int) -> list[SocietyRankOut]:
    societies = db.execute(
        select(Society, District.name, func.count(SocietyMember.user_id))
        .join(District, District.id == Society.district_id)
        .join(SocietyMember, SocietyMember.society_id == Society.id)
        .where(Society.district_id == district_id)
        .group_by(Society.id, District.name)
    ).all()
    ranked = [(s, d, n) for s, d, n in societies if n >= MIN_GROUP_SIZE]
    totals = _month_totals(db, [s.id for s, _, _ in ranked])
    rows = sorted(
        ((s, d, n, totals.get(s.id, (0.0, 0))[0] / n) for s, d, n in ranked), key=lambda r: (-r[3], r[0].id)
    )
    return [
        SocietyRankOut(rank=i + 1, society_id=s.id, name=s.name, district=d, members=n,
                       co2_per_member_kg=round(per, 2), is_mine=False)
        for i, (s, d, n, per) in enumerate(rows)
    ]


def _society_out(db, user: User, m: SocietyMember) -> SocietyOut:
    s = m.society
    committee = m.role == "committee"
    members = db.execute(
        select(SocietyMember, User.name).join(User, User.id == SocietyMember.user_id).where(SocietyMember.society_id == s.id)
    ).all()
    count = len(members)
    visible = count >= MIN_GROUP_SIZE
    co2, actions = _month_totals(db, [s.id]).get(s.id, (0.0, 0))

    rank = next((r.rank for r in _ranking(db, s.district_id) if r.society_id == s.id), None)
    ann = db.execute(
        select(SocietyAnnouncement, User.name)
        .join(User, User.id == SocietyAnnouncement.author_id)
        .where(SocietyAnnouncement.society_id == s.id)
        .order_by(SocietyAnnouncement.created_at.desc())
        .limit(10)
    ).all()

    member_rows = None
    if committee:
        start = period_start("month")
        counts = dict(
            db.execute(
                select(ActionLog.user_id, func.count(ActionLog.id))
                .where(ActionLog.user_id.in_([mm.user_id for mm, _ in members]), ActionLog.status.in_(COUNTED_STATUSES),
                       ActionLog.created_at >= start)
                .group_by(ActionLog.user_id)
            ).all()
        )
        # First names and a monthly action count only: no emails, no bills, no footprint.
        member_rows = [
            SocietyMemberOut(user_id=mm.user_id, first_name=name.split()[0], role=mm.role,
                             actions_this_month=counts.get(mm.user_id, 0))
            for mm, name in sorted(members, key=lambda r: (r[0].role != "committee", r[0].joined_at))
        ]
    return SocietyOut(
        id=s.id, name=s.name, district=s.district.name, role=m.role, member_count=count,
        join_code=s.join_code if committee else None,
        stats_visible=visible, min_group_size=MIN_GROUP_SIZE,
        co2_avoided_kg=round(co2, 1) if visible else None, actions=actions if visible else None,
        goal_kg_month=s.goal_kg_month,
        goal_progress_pct=round(min(co2 / s.goal_kg_month * 100, 100), 1) if visible and s.goal_kg_month else None,
        rank=rank,
        announcements=[AnnouncementOut(id=a.id, text=a.text, author=n.split()[0], created_at=a.created_at) for a, n in ann],
        members=member_rows,
    )


@router.post("", response_model=SocietyOut, status_code=status.HTTP_201_CREATED)
def create_society(body: SocietyCreateIn, user: CurrentUser, db: DbSession):
    if user.society_member:
        raise HTTPException(status.HTTP_409_CONFLICT, "Leave your current society before creating another")
    if user.district_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Add your district in your profile first")
    society = Society(name=body.name.strip(), district_id=user.district_id, join_code=_new_code(db),
                      goal_kg_month=body.goal_kg_month)
    db.add(society)
    db.flush()
    db.add(SocietyMember(user_id=user.id, society_id=society.id, role="committee"))
    db.commit()
    db.refresh(user)
    return _society_out(db, user, user.society_member)


@router.post("/join", response_model=SocietyOut)
def join_society(body: SocietyJoinIn, user: CurrentUser, db: DbSession):
    if user.society_member:
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already in a society")
    society = db.scalar(select(Society).where(Society.join_code == body.code.strip().upper()))
    if society is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No society has that code")
    db.add(SocietyMember(user_id=user.id, society_id=society.id, role="member"))
    db.commit()
    db.refresh(user)
    return _society_out(db, user, user.society_member)


@router.get("/mine", response_model=SocietyOut)
def my_society(user: CurrentUser, db: DbSession):
    return _society_out(db, user, _membership(user))


@router.get("/leaderboard", response_model=list[SocietyRankOut])
def society_leaderboard(user: CurrentUser, db: DbSession):
    """Societies in my district with at least 5 members, by CO2 avoided per member this month."""
    if user.district_id is None:
        return []
    mine = user.society_member.society_id if user.society_member else None
    rows = _ranking(db, user.district_id)
    for r in rows:
        r.is_mine = r.society_id == mine
    return rows


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_society(user: CurrentUser, db: DbSession):
    m = _membership(user)
    remove_member(db, m)
    db.commit()


def remove_member(db, m: SocietyMember) -> None:
    """Take a member out. A society never ends up without a committee: the longest-standing
    member is promoted, and an empty society is deleted."""
    society_id, was_committee = m.society_id, m.role == "committee"
    db.delete(m)
    db.flush()
    rest = db.scalars(select(SocietyMember).where(SocietyMember.society_id == society_id).order_by(SocietyMember.joined_at)).all()
    if not rest:
        db.execute(SocietyAnnouncement.__table__.delete().where(SocietyAnnouncement.society_id == society_id))
        db.execute(Society.__table__.delete().where(Society.id == society_id))
    elif was_committee and not any(r.role == "committee" for r in rest):
        rest[0].role = "committee"


@router.patch("/goal", response_model=SocietyOut)
def set_goal(body: SocietyGoalIn, user: CurrentUser, db: DbSession):
    m = _committee(user)
    m.society.goal_kg_month = body.goal_kg_month
    db.commit()
    return _society_out(db, user, m)


@router.post("/announcements", response_model=SocietyOut, status_code=status.HTTP_201_CREATED)
def post_announcement(body: AnnouncementIn, user: CurrentUser, db: DbSession):
    m = _committee(user)
    db.add(SocietyAnnouncement(society_id=m.society_id, author_id=user.id, text=body.text.strip()))
    others = db.scalars(select(SocietyMember.user_id).where(SocietyMember.society_id == m.society_id,
                                                           SocietyMember.user_id != user.id)).all()
    for uid in others:
        notify(db, uid, "announcement", "/society", text=body.text.strip()[:140])
    db.commit()
    return _society_out(db, user, m)


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(announcement_id: int, user: CurrentUser, db: DbSession):
    m = _committee(user)
    a = db.get(SocietyAnnouncement, announcement_id)
    if a is None or a.society_id != m.society_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such announcement")
    db.delete(a)
    db.commit()


@router.post("/members/{member_id}/committee", response_model=SocietyOut)
def make_committee(member_id: int, user: CurrentUser, db: DbSession):
    m = _committee(user)
    target = db.get(SocietyMember, member_id)
    if target is None or target.society_id != m.society_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such member")
    target.role = "committee"
    db.commit()
    return _society_out(db, user, m)


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_society_member(member_id: int, user: CurrentUser, db: DbSession):
    m = _committee(user)
    target = db.get(SocietyMember, member_id)
    if target is None or target.society_id != m.society_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such member")
    remove_member(db, target)
    db.commit()


@router.get("/report.csv")
def society_report(user: CurrentUser, db: DbSession):
    """Monthly figures for the committee's own records. Totals only: no names, emails or bills."""
    m = _committee(user)
    out = _society_out(db, user, m)
    if not out.stats_visible:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Reports unlock once {MIN_GROUP_SIZE} households have joined")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Nidhi society report", out.name, out.district, datetime.now().strftime("%Y-%m-%d")])
    w.writerow(["Households joined", out.member_count])
    w.writerow(["Actions this month", out.actions])
    w.writerow(["CO2 avoided this month (kg)", out.co2_avoided_kg])
    w.writerow(["Monthly goal (kg)", out.goal_kg_month if out.goal_kg_month is not None else ""])
    w.writerow(["Goal progress %", out.goal_progress_pct if out.goal_progress_pct is not None else ""])
    w.writerow(["Rank in district", out.rank if out.rank is not None else ""])
    name = out.name.lower().replace(" ", "-")
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="nidhi-{name}.csv"'})
