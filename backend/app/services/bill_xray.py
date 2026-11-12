"""Bill X-ray: where a household's electricity bill comes from, and the numbers for "what if".

The bill is split exactly as the DISCOM charges it (telescopic energy slabs, fixed charge, FPPAS
and electricity duty), so the parts add up to `footprint.electricity_bill_rs`. The split by
appliance is an estimate from the household's answers, scaled to fit the units actually used,
and is labelled as likely, not measured.
"""

from dataclasses import dataclass

from app.services import factors
from app.services.footprint import electricity_bill_rs
from app.services.plan import HouseholdLike, slab_insight

AC_SEASON_SHARE = 0.6  # ACs run most of the year in Gujarat, but not every month at full use
FRIDGE_KWH_MONTH = 35
LIGHTS_FANS_KWH_PER_PERSON = 10
LIGHTS_FANS_BASE_KWH = 20
GEYSER_USES_PER_MONTH = 15
WASHING_LOADS_PER_MONTH = 12
EV_CHARGES_PER_MONTH = 12


@dataclass(frozen=True)
class SlabUse:
    upto: float | None  # upper bound of the slab in kWh; None for the last, open-ended slab
    rate: float
    units: float
    rs: float


@dataclass(frozen=True)
class Use:
    key: str  # ac, fridge, lights_fans, geyser, washing, ev, standby, other
    kwh: float


@dataclass(frozen=True)
class Xray:
    kwh: float
    total_rs: float
    energy_rs: float
    fixed_rs: float
    fppas_rs: float
    duty_rs: float
    slabs: list[SlabUse]
    top_rate: float
    uses: list[Use]
    slab_units_over: float | None
    slab_rs_if_cut: float | None


def tariff_for(discom: str, area: str) -> factors.Tariff:
    return factors.TARIFFS.get((discom, area)) or factors.TARIFFS[(factors.DEFAULT_DISCOM, factors.DEFAULT_AREA)]


def _slab_uses(kwh: float, tariff: factors.Tariff) -> list[SlabUse]:
    uses, lower = [], 0.0
    for upper, rate in tariff.slabs:
        units = max(0.0, min(kwh, upper) - lower)
        uses.append(SlabUse(None if upper == float("inf") else upper, rate, round(units, 1), round(units * rate, 2)))
        lower = upper
    return uses


def likely_uses(h: HouseholdLike, kwh: float, members: int) -> list[Use]:
    """Where the units probably go, from the household's appliances, scaled to the real total."""
    raw: dict[str, float] = {
        "ac": h.ac_count * factors.AC_KWH_PER_DAY * 30 * AC_SEASON_SHARE,
        "fridge": FRIDGE_KWH_MONTH,
        "lights_fans": LIGHTS_FANS_BASE_KWH + LIGHTS_FANS_KWH_PER_PERSON * max(members, 1),
        "geyser": factors.HEAVY_LOAD_KWH["geyser"] * GEYSER_USES_PER_MONTH if h.has_geyser else 0.0,
        "washing": factors.HEAVY_LOAD_KWH["washing machine"] * WASHING_LOADS_PER_MONTH if h.has_washing_machine else 0.0,
        "ev": factors.HEAVY_LOAD_KWH["EV charging"] * EV_CHARGES_PER_MONTH if h.has_ev else 0.0,
        "standby": factors.STANDBY_KWH_PER_NIGHT * 30,
    }
    total = sum(raw.values())
    if kwh <= 0 or total <= 0:
        return []
    scale = min(1.0, kwh / total)
    uses = [Use(k, round(v * scale, 1)) for k, v in raw.items() if v > 0]
    other = round(kwh - sum(u.kwh for u in uses), 1)
    if other > 0.5:
        uses.append(Use("other", other))
    return sorted(uses, key=lambda u: u.kwh, reverse=True)


def xray(h: HouseholdLike, kwh: float, members: int) -> Xray:
    tariff = tariff_for(h.discom, h.area)
    slabs = _slab_uses(kwh, tariff)
    energy = sum(s.rs for s in slabs)
    fppas = kwh * tariff.fppas_rs_per_kwh
    total = electricity_bill_rs(kwh, h.discom, h.area)
    # Duty takes up the rounding, so the parts on screen always add up to the bill.
    duty = total - round(energy, 2) - tariff.fixed_rs_per_month - round(fppas, 2)
    top = next((s.rate for s in reversed(slabs) if s.units > 0), tariff.slabs[0][1])
    probe = _AtUnits(h, kwh)
    insight = slab_insight(probe)
    return Xray(
        kwh=round(kwh, 1),
        total_rs=total,
        energy_rs=round(energy, 2),
        fixed_rs=tariff.fixed_rs_per_month,
        fppas_rs=round(fppas, 2),
        duty_rs=round(duty, 2),
        slabs=slabs,
        top_rate=top,
        uses=likely_uses(h, kwh, members),
        slab_units_over=insight.units_over if insight else None,
        slab_rs_if_cut=insight.rs_if_cut if insight else None,
    )


class _AtUnits:
    """The household, as if it had used `kwh` this month (for a freshly scanned bill)."""

    def __init__(self, h: HouseholdLike, kwh: float):
        self._h, self.monthly_kwh = h, kwh

    def __getattr__(self, name: str):
        return getattr(self._h, name)


def simulator_inputs(h: HouseholdLike, kwh_per_kwp_year: float) -> dict[str, float]:
    """kWh a month each "what if" lever saves, so the app can recompute the bill as you tap."""
    ac_month = h.ac_count * factors.AC_KWH_PER_DAY * 30 * AC_SEASON_SHARE
    return {
        "ac_kwh_per_degree": round(ac_month * factors.AC_SAVING_PER_DEGREE, 2),
        "geyser_kwh": round(factors.GEYSER_STANDBY_KWH_PER_DAY * 30, 1) if h.has_geyser else 0.0,
        "standby_kwh": round(factors.STANDBY_KWH_PER_NIGHT * 30, 1),
        "led_kwh_each": round(factors.LED_WATTS_SAVED / 1000 * factors.LED_HOURS_PER_DAY * 30, 2),
        "solar_kwh_per_kw": round(kwh_per_kwp_year / 12, 1),
    }
