"""The signed-in citizen's own numbers: LiFE Score, "homes like yours" and the Impact Ledger."""

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale, tr
from app.models import (
    ActionLog,
    ActionStatus,
    ActionType,
    EnergyReading,
    Household,
    Role,
    User,
)
from app.schemas import LedgerOut, LifeScoreOut, PeerComparisonOut
from app.services.ledger import Entry, Figures, Ledger
from app.services.plan import build_plan
from app.services.score import compare, life_score
from app.services.stats import period_start
from app.timeutil import IST, as_utc, now_ist

router = APIRouter(prefix="/api/me", tags=["me"])

Period = Literal["month", "all"]


def ledger_for(db, users: list[User], period: Period) -> LedgerOut:
    """Impact Ledger summed over these users: their plans (estimated) and their logs by review status.

    Rupees for logged kWh use each household's own marginal rate, so units cut from a top
    slab are worth what that household actually pays for them.
    """
    themes = dict(db.execute(select(ActionType.code, ActionType.theme)).all())
    ledger = Ledger.empty()
    rate: dict[int, float] = {}
    for u in users:
        if u.household is None:
            continue
        plan = build_plan(u.household)
        rate[u.id] = plan.marginal_rs_per_kwh
        for i in plan.items:
            if i.kind == "habit":  # solar is an investment, not a monthly habit; the plan's total leaves it out too
                ledger.add(Entry(themes.get(i.action_code, "energy"), "estimated",
                                 Figures(i.kwh_month, i.co2_month_kg, i.rs_month)))

    q = (
        select(ActionLog.user_id, ActionType.theme, ActionLog.status,
               func.sum(ActionLog.kwh_saved), func.sum(ActionLog.co2_saved_kg), func.count(ActionLog.id))
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(ActionLog.user_id.in_([u.id for u in users]), ActionLog.status != ActionStatus.rejected)
        .group_by(ActionLog.user_id, ActionType.theme, ActionLog.status)
    )
    if (start := period_start(period)) is not None:
        q = q.where(ActionLog.created_at >= start)
    for uid, theme, st, kwh, co2, n in db.execute(q).all():
        kwh, co2 = float(kwh or 0), float(co2 or 0)
        ledger.add(Entry(theme, st.value, Figures(kwh, co2, kwh * rate.get(uid, 0.0), int(n))))

    def out(f: dict[str, Figures]) -> dict[str, dict]:
        return {s: fig.rounded() for s, fig in f.items()}

    return LedgerOut(period=period, by_status=out(ledger.by_status),
                     by_theme={t: out(statuses) for t, statuses in ledger.by_theme.items()})


@router.get("/ledger", response_model=LedgerOut)
def my_ledger(user: CurrentUser, db: DbSession, period: Period = "month"):
    """My impact by Mission LiFE theme and by status: estimated, self-reported, awaiting review, verified."""
    if user.household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    return ledger_for(db, [user], period)


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
