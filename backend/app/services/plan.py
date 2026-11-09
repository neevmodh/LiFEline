"""A household's personal savings plan: what to do, ranked by rupees a month.

Everything is computed from the household's own answers and its own bill, using the
documented factors: each step's rupees are the drop in this household's bill at its
DISCOM's slabs, so units saved from the top slab are worth more than a flat average.
Pure functions, no I/O.
"""

from dataclasses import dataclass, field
from typing import Protocol

from app.services import factors, solar
from app.services.footprint import electricity_bill_rs
from app.services.impact import action_impact

WORKING_DAYS = factors.COMMUTE_DAYS_PER_MONTH
MAX_HABIT_SHARE = 0.35  # habits together never claim more than this share of the monthly units


class HouseholdLike(Protocol):
    monthly_kwh: float
    discom: str
    area: str
    ac_count: int
    has_geyser: bool
    has_washing_machine: bool
    has_ev: bool
    has_solar: bool
    roof_area_sqm: float | None
    commute_mode: str
    commute_km_per_day: float
    lpg_cylinders_per_month: float


@dataclass(frozen=True)
class PlanItem:
    code: str
    kind: str  # habit | investment
    effort: str  # easy | medium | investment
    kwh_month: float
    rs_month: float
    co2_month_kg: float
    action_code: str | None = None
    params: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class SlabInsight:
    units_over: float  # units above the next cheaper slab
    rate_now: float
    rate_below: float
    rs_if_cut: float  # monthly saving from cutting exactly those units


@dataclass(frozen=True)
class Plan:
    bill_rs: float
    marginal_rs_per_kwh: float
    items: list[PlanItem]
    total_rs_month: float
    total_co2_month_kg: float
    slab: SlabInsight | None


def _bill(h: HouseholdLike, kwh: float) -> float:
    return electricity_bill_rs(max(kwh, 0), h.discom, h.area)


def _rs_for_saved_kwh(h: HouseholdLike, kwh: float) -> float:
    return round(_bill(h, h.monthly_kwh) - _bill(h, h.monthly_kwh - kwh), 0)


def marginal_rate(h: HouseholdLike) -> float:
    """What one more (or one fewer) unit costs this household right now."""
    step = 10
    return round((_bill(h, h.monthly_kwh) - _bill(h, h.monthly_kwh - step)) / step, 2)


def slab_insight(h: HouseholdLike) -> SlabInsight | None:
    tariff = factors.TARIFFS.get((h.discom, h.area)) or factors.TARIFFS[(factors.DEFAULT_DISCOM, factors.DEFAULT_AREA)]
    lower = 0.0
    for i, (upper, rate) in enumerate(tariff.slabs):
        if h.monthly_kwh <= upper:
            if i == 0 or h.monthly_kwh <= lower:
                return None
            units_over = h.monthly_kwh - lower
            below = tariff.slabs[i - 1][1]
            # Only worth pointing out when the gap is something a household can close.
            if units_over > 0.25 * h.monthly_kwh and units_over > 60:
                return None
            return SlabInsight(round(units_over), rate, below, _rs_for_saved_kwh(h, units_over))
        lower = upper
    return None


def build_plan(h: HouseholdLike) -> Plan:
    habits: list[tuple[str, float, str | None, str]] = []  # code, kWh a month, action code, effort
    if h.ac_count > 0:
        per_day = factors.AC_KWH_PER_DAY * factors.AC_SAVING_PER_DEGREE * factors.AC_DEGREES_RAISED
        habits.append(("ac_setpoint", per_day * h.ac_count * 30, "ac_24", "easy"))
    if h.has_geyser:
        habits.append(("geyser_timer", factors.GEYSER_STANDBY_KWH_PER_DAY * 30, "geyser_off", "easy"))
    habits.append(("standby", factors.STANDBY_KWH_PER_NIGHT * 30, "standby_off", "easy"))
    habits.append(("led", factors.LED_WATTS_SAVED / 1000 * factors.LED_HOURS_PER_DAY * 30, "led_switch", "medium"))

    cap = MAX_HABIT_SHARE * h.monthly_kwh
    total_kwh = sum(k for _, k, _, _ in habits)
    scale = min(1.0, cap / total_kwh) if total_kwh else 1.0

    items: list[PlanItem] = []
    for code, kwh, action, effort in habits:
        kwh *= scale
        params: dict[str, object] = {"kwh": round(kwh), "acs": h.ac_count}
        items.append(
            PlanItem(
                code=code, kind="habit", effort=effort, kwh_month=round(kwh, 1),
                rs_month=_rs_for_saved_kwh(h, kwh), co2_month_kg=round(kwh * factors.GRID_KG_CO2_PER_KWH, 1),
                action_code=action, params=params,
            )
        )

    if h.has_washing_machine or h.has_geyser or h.has_ev:
        shift = action_impact("shift_heavy_load", h)  # type: ignore[arg-type]
        items.append(
            PlanItem(
                code="peak_shift", kind="habit", effort="easy", kwh_month=0.0, rs_month=0.0,
                co2_month_kg=round(shift.co2_kg * WORKING_DAYS, 1), action_code="shift_heavy_load",
                params={"peak": factors.peak_label()},
            )
        )

    if h.commute_mode in ("car", "two_wheeler") and h.commute_km_per_day > 0:
        per_km = factors.COMMUTE_KG_CO2_PER_KM[h.commute_mode] - factors.COMMUTE_KG_CO2_PER_KM["bus"]
        items.append(
            PlanItem(
                code="commute", kind="habit", effort="medium", kwh_month=0.0, rs_month=0.0,
                co2_month_kg=round(h.commute_km_per_day * WORKING_DAYS * per_km, 1), action_code="public_transport",
                params={"km": round(h.commute_km_per_day), "mode": h.commute_mode},
            )
        )

    if not h.has_solar and h.roof_area_sqm and h.roof_area_sqm >= 5:
        est = solar.estimate(h.roof_area_sqm, h.monthly_kwh, None, h.discom, h.area)
        if est.recommended_kwp > 0:
            items.append(
                PlanItem(
                    code="solar", kind="investment", effort="investment", kwh_month=round(est.annual_generation_kwh / 12, 1),
                    rs_month=round(est.annual_savings_rs / 12), co2_month_kg=round(est.annual_co2_avoided_kg / 12, 1),
                    params={"kwp": est.recommended_kwp, "net_cost": round(est.net_cost_rs),
                            "payback": est.payback_years, "subsidy": round(est.subsidy_rs)},
                )
            )

    order = {"easy": 0, "medium": 1, "investment": 2}
    items.sort(key=lambda i: (order[i.effort], -i.rs_month, -i.co2_month_kg))
    habits_only = [i for i in items if i.kind == "habit"]
    return Plan(
        bill_rs=_bill(h, h.monthly_kwh),
        marginal_rs_per_kwh=marginal_rate(h),
        items=items,
        total_rs_month=round(sum(i.rs_month for i in habits_only)),
        total_co2_month_kg=round(sum(i.co2_month_kg for i in habits_only), 1),
        slab=slab_insight(h),
    )
