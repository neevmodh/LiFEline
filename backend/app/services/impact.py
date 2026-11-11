"""What one green action saves for a specific household.

Pure functions, like services/footprint.py: given an action code and the
household's onboarding answers, return the kWh and kg CO2 it saves, or why it
doesn't apply. Logging is refused for actions that don't apply (no AC, no
geyser, already commuting by bus...) so points and impact stay honest.
"""

from dataclasses import dataclass
from typing import Protocol

from app.i18n import tr
from app.services import factors


class HouseholdLike(Protocol):
    ac_count: int
    has_geyser: bool
    has_washing_machine: bool
    has_ev: bool
    commute_mode: str
    commute_km_per_day: float
    lpg_cylinders_per_month: float


@dataclass(frozen=True)
class Impact:
    kwh: float
    co2_kg: float
    applicable: bool = True
    reason_key: str | None = None  # why it doesn't apply (locales: reason.<key>)
    estimated: bool = True  # False: points only, no defensible CO2 or kWh figure

    def reason(self, locale: str = "en") -> str | None:
        return tr(locale, f"reason.{self.reason_key}") if self.reason_key else None


def _electricity(kwh: float) -> Impact:
    return Impact(kwh=round(kwh, 2), co2_kg=round(kwh * factors.GRID_KG_CO2_PER_KWH, 2))


def _not_applicable(reason_key: str) -> Impact:
    return Impact(kwh=0.0, co2_kg=0.0, applicable=False, reason_key=reason_key)


def _heavy_loads(h: HouseholdLike) -> list[str]:
    present = {"washing machine": h.has_washing_machine, "geyser": h.has_geyser, "EV charging": h.has_ev}
    return [name for name, has in present.items() if has]


def _trip_km(h: HouseholdLike) -> float:
    """One trip is half the daily round trip."""
    return h.commute_km_per_day / 2


def action_impact(code: str, h: HouseholdLike) -> Impact:
    if code == "ac_24":
        if h.ac_count < 1:
            return _not_applicable("no_ac")
        per_ac = factors.AC_KWH_PER_DAY * factors.AC_SAVING_PER_DEGREE * factors.AC_DEGREES_RAISED
        return _electricity(per_ac * h.ac_count)

    if code == "geyser_off":
        if not h.has_geyser:
            return _not_applicable("no_geyser")
        return _electricity(factors.GEYSER_STANDBY_KWH_PER_DAY)

    if code == "shift_heavy_load":
        loads = _heavy_loads(h)
        if not loads:
            return _not_applicable("no_heavy_load")
        # Conservative: credit the smallest heavy load the household has. Moving it off-peak
        # doesn't cut kWh, but those units no longer come from the fossil plants that meet the peak.
        moved = min(factors.HEAVY_LOAD_KWH[name] for name in loads)
        co2 = moved * (factors.GRID_OPERATING_MARGIN_KG_CO2_PER_KWH - factors.GRID_KG_CO2_PER_KWH)
        return Impact(kwh=0.0, co2_kg=round(co2, 2))

    if code == "standby_off":
        return _electricity(factors.STANDBY_KWH_PER_NIGHT)

    if code == "led_switch":
        return _electricity(factors.LED_WATTS_SAVED / 1000 * factors.LED_HOURS_PER_DAY * factors.LED_CREDIT_DAYS)

    if code == "public_transport":
        if h.commute_mode not in ("car", "two_wheeler"):
            return _not_applicable("no_private_vehicle")
        if h.commute_km_per_day <= 0:
            return _not_applicable("no_commute_distance")
        per_km = factors.COMMUTE_KG_CO2_PER_KM[h.commute_mode] - factors.COMMUTE_KG_CO2_PER_KM["bus"]
        return Impact(kwh=0.0, co2_kg=round(_trip_km(h) * per_km, 2))

    if code == "cycle_walk":
        per_km = factors.COMMUTE_KG_CO2_PER_KM[h.commute_mode]
        if per_km == 0:
            return _not_applicable("already_walks")
        if h.commute_km_per_day <= 0:
            return _not_applicable("no_commute_distance")
        km = min(_trip_km(h), factors.SHORT_TRIP_MAX_KM)
        return Impact(kwh=0.0, co2_kg=round(km * per_km, 2))

    if code == "pressure_cooker":
        if h.lpg_cylinders_per_month <= 0:
            return _not_applicable("no_lpg")
        lpg_kg_per_day = h.lpg_cylinders_per_month * factors.LPG_KG_PER_CYLINDER / 30
        co2 = lpg_kg_per_day * factors.PRESSURE_COOKER_LPG_SAVING * factors.LPG_KG_CO2_PER_KG
        return Impact(kwh=0.0, co2_kg=round(co2, 2))

    if code == "carpool":
        if h.commute_mode != "car":
            return _not_applicable("no_car")
        if h.commute_km_per_day <= 0:
            return _not_applicable("no_commute_distance")
        co2 = _trip_km(h) * factors.COMMUTE_KG_CO2_PER_KM["car"] * factors.CARPOOL_SHARE_SAVED
        return Impact(kwh=0.0, co2_kg=round(co2, 2))

    if code in factors.POINTS_ONLY_ACTIONS:
        return Impact(kwh=0.0, co2_kg=0.0, estimated=False)

    raise ValueError(f"Unknown action: {code}")
