"""The household's personal savings plan."""

from types import SimpleNamespace

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale, tr
from app.models import ActionLog, ActionStatus, ActionType
from app.ratelimit import client_ip, guest_limiter
from app.schemas import (
    ForecastIn,
    ForecastOut,
    GuestCheckIn,
    GuestCheckOut,
    PlanItemOut,
    PlanOut,
)
from app.services import factors
from app.services.forecast import forecast
from app.services.plan import build_plan
from app.timeutil import ist_day_bounds_utc, today_ist

router = APIRouter(prefix="/api", tags=["plan"])


def inr(n: float) -> str:
    """Indian digit grouping without the symbol: 100000 -> 1,00,000."""
    digits = f"{round(n):d}"
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    return ",".join(([head] if head else []) + groups + [tail])


def render_plan(plan, locale: str, done_codes: set[str] | frozenset[str] = frozenset()) -> PlanOut:
    """A plan with its text in the reader's language; `done_codes` marks steps already logged today."""
    items = []
    for i in plan.items:
        params = {**i.params, "co2": i.co2_month_kg}
        for key in ("subsidy", "net_cost"):
            if key in params:
                params[key] = inr(float(params[key]))  # type: ignore[arg-type]
        if "mode" in params:
            params["mode"] = tr(locale, f"mode.{params['mode']}")
        items.append(
            PlanItemOut(
                code=i.code, kind=i.kind, effort=i.effort,  # type: ignore[arg-type]
                title=tr(locale, f"plan.{i.code}.title"), why=tr(locale, f"plan.{i.code}.why", **params),
                kwh_month=i.kwh_month, rs_month=i.rs_month, co2_month_kg=i.co2_month_kg,
                action_code=i.action_code, logged_today=i.action_code in done_codes,
            )
        )
    slab = plan.slab
    return PlanOut(
        bill_rs=plan.bill_rs,
        marginal_rs_per_kwh=plan.marginal_rs_per_kwh,
        items=items,
        total_rs_month=plan.total_rs_month,
        total_co2_month_kg=plan.total_co2_month_kg,
        slab_note=tr(locale, "plan.slab", units=round(slab.units_over), now=f"{slab.rate_now:.2f}",
                     below=f"{slab.rate_below:.2f}", rs=inr(slab.rs_if_cut)) if slab else None,
        slab_rs_month=slab.rs_if_cut if slab else None,
    )


@router.get("/plan", response_model=PlanOut)
def my_plan(user: CurrentUser, db: DbSession, locale: RequestLocale):
    """Ranked steps for this household, each with rupees a month from its own bill and why."""
    household = user.household
    if household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    start, end = ist_day_bounds_utc(today_ist())
    done_codes = set(
        db.scalars(
            select(ActionType.code)
            .join(ActionLog, ActionLog.action_type_id == ActionType.id)
            .where(
                ActionLog.user_id == user.id,
                ActionLog.status != ActionStatus.rejected,
                ActionLog.created_at >= start,
                ActionLog.created_at < end,
            )
        )
    )
    return render_plan(build_plan(household), locale, done_codes)


@router.post("/guest/check", response_model=GuestCheckOut)
def guest_check(body: GuestCheckIn, request: Request, locale: RequestLocale):
    """Try LiFEline without an account: the same plan a member gets, from a few answers. Nothing is stored."""
    guest_limiter.check(client_ip(request))
    household = SimpleNamespace(
        monthly_kwh=body.monthly_kwh, discom=body.discom, area=body.area, ac_count=body.ac_count,
        has_geyser=body.has_geyser, has_washing_machine=body.has_washing_machine, has_ev=False, has_solar=False,
        roof_area_sqm=body.roof_area_sqm, commute_mode="cycle_walk", commute_km_per_day=0, lpg_cylinders_per_month=1,
    )
    kg = body.monthly_kwh * factors.GRID_KG_CO2_PER_KWH
    return GuestCheckOut(plan=render_plan(build_plan(household), locale), electricity_kg_month=round(kg, 1),
                         electricity_kg_year=round(kg * 12))


@router.post("/forecast", response_model=ForecastOut)
def bill_forecast(body: ForecastIn, user: CurrentUser, db: DbSession):
    """Project this month's units and bill from a meter reading taken so far this month."""
    from app.models import Household  # noqa: PLC0415

    h = db.scalar(select(Household).where(Household.user_id == user.id))
    if h is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Finish your household profile first")
    today = today_ist()
    day = body.day or today.day
    f = forecast(body.used_kwh, day, today.year, today.month, h.discom, h.area)
    saving = round(f.projected_bill_rs - f.bill_if_budget_rs, 2) if f.bill_if_budget_rs is not None else None
    return ForecastOut(
        day=f.day, days_in_month=f.days_in_month, used_kwh=f.used_kwh, daily_kwh=f.daily_kwh,
        projected_kwh=f.projected_kwh, projected_bill_rs=f.projected_bill_rs, next_slab_kwh=f.next_slab_kwh,
        kwh_to_next_slab=f.kwh_to_next_slab, daily_budget_kwh=f.daily_budget_kwh,
        bill_if_budget_rs=f.bill_if_budget_rs, saving_if_budget_rs=saving,
        note="Straight-line projection: it assumes the rest of the month looks like the days so far.",
    )
