"""The household's personal savings plan."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale, tr
from app.models import ActionLog, ActionStatus, ActionType
from app.schemas import PlanItemOut, PlanOut
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


@router.get("/plan", response_model=PlanOut)
def my_plan(user: CurrentUser, db: DbSession, locale: RequestLocale):
    """Ranked steps for this household, each with rupees a month from its own bill and why."""
    household = user.household
    if household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    plan = build_plan(household)

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
