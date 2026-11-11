"""Campaigns: shared, time-boxed challenges.

GEDA runs state or district campaigns; a society committee runs campaigns for its own society.
A Peak Hour Challenge (kind="peak") is a one-day GEDA event with an hour window: only heavy-load
shifts logged between those hours count, and the scheduler reminds people 30 minutes before.
Progress counts self-reported and verified actions by people in scope during the dates, so
nobody has to "join": doing the action is taking part. Only counts are shown, never names.
"""

from datetime import datetime, time, timedelta

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import (
    ActionLog,
    ActionType,
    Campaign,
    District,
    Role,
    Society,
    SocietyMember,
    User,
)
from app.schemas import CampaignIn, CampaignOut
from app.services.notify import notify
from app.services.share_card import render_certificate
from app.services.stats import COUNTED_STATUSES
from app.timeutil import IST, as_utc, now_ist, today_ist

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])
MAX_DAYS = 92
PEAK_ACTION = "shift_heavy_load"


def _scope_users(c: Campaign):
    """A SQL condition on User/SocietyMember for the people a campaign covers."""
    q = select(User.id).where(User.role == Role.citizen)
    if c.scope == "district":
        q = q.where(User.district_id == c.scope_id)
    elif c.scope == "society":
        q = q.join(SocietyMember, SocietyMember.user_id == User.id).where(SocietyMember.society_id == c.scope_id)
    return q


def _window(c: Campaign):
    if c.kind == "peak" and c.start_hour is not None and c.end_hour is not None:
        day = datetime.combine(c.starts_on, time.min, tzinfo=IST)
        return as_utc(day + timedelta(hours=c.start_hour)), as_utc(day + timedelta(hours=c.end_hour))
    start = as_utc(datetime.combine(c.starts_on, time.min, tzinfo=IST))
    end = as_utc(datetime.combine(c.ends_on + timedelta(days=1), time.min, tzinfo=IST))
    return start, end


def peak_events_today(db, user: User) -> list[Campaign]:
    """Peak events today that cover this person, for Home and the scheduler's reminder."""
    visible = _visible(user)
    today = today_ist()
    return [c for c in db.scalars(select(Campaign).where(Campaign.kind == "peak", Campaign.starts_on == today))
            if visible(c)]


def _progress(db, c: Campaign, user_id: int | None = None):
    start, end = _window(c)
    q = (
        select(ActionLog.user_id, func.count(ActionLog.id))
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(ActionLog.user_id.in_(_scope_users(c)), ActionLog.status.in_(COUNTED_STATUSES),
               ActionLog.created_at >= start, ActionLog.created_at < end)
        .group_by(ActionLog.user_id)
    )
    if c.action_code:
        q = q.where(ActionType.code == c.action_code)
    rows = db.execute(q).all()
    return sum(n for _, n in rows), len(rows), next((n for uid, n in rows if uid == user_id), 0)


def _label(db, c: Campaign) -> str:
    if c.scope == "state":
        return "All of Gujarat"
    if c.scope == "district":
        return db.get(District, c.scope_id).name
    society = db.get(Society, c.scope_id)
    return society.name if society else "Society"


def _visible(user: User):
    mine = user.society_member.society_id if user.society_member else None
    return lambda c: (
        c.scope == "state"
        or (c.scope == "district" and c.scope_id == user.district_id)
        or (c.scope == "society" and c.scope_id == mine)
    )


def _out(db, c: Campaign, user: User) -> CampaignOut:
    today = today_ist()
    status_ = "upcoming" if today < c.starts_on else "finished" if today > c.ends_on else "active"
    done, people, mine = _progress(db, c, user.id)
    action = db.scalar(select(ActionType.title).where(ActionType.code == c.action_code)) if c.action_code else None
    return CampaignOut(
        id=c.id, title=c.title, description=c.description, action_title=action, scope=c.scope,
        scope_label=_label(db, c), status=status_, starts_on=c.starts_on, ends_on=c.ends_on,
        days_left=max((c.ends_on - today).days, 0) if status_ != "finished" else 0,
        target=c.target, progress=done, progress_pct=round(min(done / c.target * 100, 100), 1),
        participants=people, my_count=mine,
        can_delete=user.role == Role.admin or c.created_by == user.id,
        certificate=status_ == "finished" and mine > 0,
        kind=c.kind, start_hour=c.start_hour, end_hour=c.end_hour, live=_live(c, status_),
    )


def _live(c: Campaign, status_: str) -> bool:
    if status_ != "active":
        return False
    if c.kind != "peak":
        return True
    start, end = _window(c)
    return start <= as_utc(now_ist()) < end


@router.get("", response_model=list[CampaignOut])
def my_campaigns(user: CurrentUser, db: DbSession):
    """Campaigns I'm covered by: statewide, my district's and my society's. Newest first."""
    visible = _visible(user)
    rows = [c for c in db.scalars(select(Campaign).order_by(Campaign.starts_on.desc())) if visible(c)]
    return [_out(db, c, user) for c in rows]


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(body: CampaignIn, user: CurrentUser, db: DbSession):
    if body.ends_on < body.starts_on or (body.ends_on - body.starts_on).days > MAX_DAYS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"A campaign runs up to {MAX_DAYS} days")
    if body.ends_on < today_ist():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "That campaign would already be over")
    if body.kind == "peak":
        if body.scope == "society":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Peak Hour Challenges are run by GEDA")
        if body.starts_on != body.ends_on:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "A Peak Hour Challenge is one day")
        if body.start_hour is None or body.end_hour is None or body.end_hour <= body.start_hour:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Give the event's start and end hour")
        body.action_code = PEAK_ACTION  # the only action that measures moving load out of the peak
    if body.action_code and not db.scalar(select(ActionType.id).where(ActionType.code == body.action_code)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown action")

    scope_id: int | None
    if body.scope == "state":
        if user.role != Role.admin:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the GEDA state team can run statewide campaigns")
        scope_id = None
    elif body.scope == "district":
        if user.role not in (Role.admin, Role.officer):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only GEDA can run district campaigns")
        scope_id = body.scope_id if user.role == Role.admin else user.district_id
        if scope_id is None or not db.get(District, scope_id):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a district")
        if user.role == Role.officer and body.scope_id not in (None, user.district_id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "District officers can only run campaigns in their own district")
    else:
        if not user.society_member or user.society_member.role != "committee":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a society committee can run society campaigns")
        scope_id = user.society_member.society_id

    c = Campaign(title=body.title.strip(), description=body.description.strip(), action_code=body.action_code,
                 target=body.target, starts_on=body.starts_on, ends_on=body.ends_on, scope=body.scope,
                 scope_id=scope_id, created_by=user.id, kind=body.kind,
                 start_hour=body.start_hour if body.kind == "peak" else None,
                 end_hour=body.end_hour if body.kind == "peak" else None)
    db.add(c)
    if c.scope == "society":
        for uid in db.scalars(select(SocietyMember.user_id).where(SocietyMember.society_id == c.scope_id,
                                                                  SocietyMember.user_id != user.id)):
            notify(db, uid, "campaign", "/society", title=c.title)
    db.commit()
    return _out(db, c, user)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(campaign_id: int, user: CurrentUser, db: DbSession):
    c = db.get(Campaign, campaign_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such campaign")
    if not (user.role == Role.admin or c.created_by == user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only remove campaigns you created")
    db.delete(c)
    db.commit()


@router.get("/{campaign_id}/certificate.png")
def certificate(campaign_id: int, user: CurrentUser, db: DbSession):
    c = db.get(Campaign, campaign_id)
    if c is None or not _visible(user)(c):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such campaign")
    out = _out(db, c, user)
    if not out.certificate:
        raise HTTPException(status.HTTP_409_CONFLICT, "Certificates are for people who took part, once the campaign has ended")
    png = render_certificate(user.name.split()[0], c.title, out.scope_label, out.my_count, out.progress, c.target,
                             f"{c.starts_on:%d %b} to {c.ends_on:%d %b %Y}")
    return Response(png, media_type="image/png", headers={"Cache-Control": "private, no-store"})
