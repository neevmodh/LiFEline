"""The signed-in citizen's own numbers: LiFE Score, "homes like yours" and the Impact Ledger."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale, tr
from app.models import (
    ActionLog,
    ActionStatus,
    EnergyReading,
    Household,
    Role,
    User,
)
from app.schemas import LedgerOut, LedgerPeriod, LifeScoreOut, PeerComparisonOut
from app.services.ledger import ledger_for
from app.services.score import compare, life_score
from app.timeutil import IST, as_utc, now_ist

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("/ledger", response_model=LedgerOut)
def my_ledger(user: CurrentUser, db: DbSession, period: LedgerPeriod = "month"):
    """My impact by Mission LiFE theme and by status: estimated, self-reported, awaiting review, verified."""
    if user.household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    return LedgerOut(period=period, **ledger_for(db, [user], period).rounded())


def _peer_kwh(db, me: User, household: Household, district_only: bool) -> list[float]:
    """Declared monthly use of similar homes: household size within one person, same AC bracket (0, 1, 2+)."""
    ac = min(household.ac_count, 2)
    q = (
        select(Household.monthly_kwh, Household.ac_count)
        .join(User, User.id == Household.user_id)
        .where(User.role == Role.citizen, User.id != me.id,
               Household.members.between(household.members - 1, household.members + 1))
    )
    if district_only:
        q = q.where(User.district_id == me.district_id)
    return [kwh for kwh, n_ac in db.execute(q).all() if min(n_ac, 2) == ac]


@router.get("/score", response_model=LifeScoreOut)
def my_score(user: CurrentUser, db: DbSession, locale: RequestLocale):
    household = user.household
    if household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")

    latest = db.scalar(select(EnergyReading.kwh).where(EnergyReading.user_id == user.id)
                       .order_by(EnergyReading.month.desc()).limit(1))
    my_kwh = latest if latest is not None else household.monthly_kwh
    cmp_ = compare(
        my_kwh, household.monthly_kwh,
        _peer_kwh(db, user, household, district_only=True) if user.district_id else [],
        _peer_kwh(db, user, household, district_only=False),
    )

    now = now_ist()
    rows = db.execute(
        select(ActionLog.created_at, ActionLog.status).where(
            ActionLog.user_id == user.id, ActionLog.status != ActionStatus.rejected,
            ActionLog.created_at >= as_utc(now) - timedelta(days=30),
        )
    ).all()
    cutoff14 = (now - timedelta(days=14)).date()
    active_days = len({as_utc(at).astimezone(IST).date() for at, _ in rows if as_utc(at).astimezone(IST).date() > cutoff14})
    verified = sum(1 for _, st in rows if st == ActionStatus.verified)
    s = life_score(cmp_, active_days, verified)

    district = user.district.name if user.district else ""
    if cmp_.scope == "own_baseline":
        summary = tr(locale, "score.own", mine=round(cmp_.my_kwh), typical=round(cmp_.typical_kwh))
    else:
        summary = tr(locale, f"score.{cmp_.scope}", mine=round(cmp_.my_kwh), typical=round(cmp_.typical_kwh),
                     efficient=round(cmp_.efficient_kwh or 0), n=cmp_.group_size, district=district)
    return LifeScoreOut(
        score=s.score, efficiency=s.efficiency, consistency=s.consistency, verified=s.verified,
        active_days_14=active_days, verified_30=verified,
        comparison=PeerComparisonOut(**cmp_.__dict__, summary=summary),
    )
