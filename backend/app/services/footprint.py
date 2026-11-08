from dataclasses import dataclass

from app.services import factors


@dataclass(frozen=True)
class FootprintInput:
    monthly_kwh: float
    members: int
    lpg_cylinders_per_month: float
    commute_mode: str
    commute_km_per_day: float


@dataclass(frozen=True)
class FootprintBreakdown:
    electricity_kg: float
    cooking_kg: float
    commute_kg: float
    total_kg: float
    per_capita_kg: float


def monthly_footprint(inp: FootprintInput) -> FootprintBreakdown:
    """Monthly household CO2 footprint in kg, split by source.

    Electricity and cooking are shared by the household; commute is per earning
    member as entered by the user, so it is not divided again.
    """
    if inp.commute_mode not in factors.COMMUTE_KG_CO2_PER_KM:
        raise ValueError(f"Unknown commute mode: {inp.commute_mode}")

    electricity = inp.monthly_kwh * factors.GRID_KG_CO2_PER_KWH
    cooking = inp.lpg_cylinders_per_month * factors.LPG_KG_CO2_PER_CYLINDER
    commute = (
        inp.commute_km_per_day
        * factors.COMMUTE_DAYS_PER_MONTH
        * factors.COMMUTE_KG_CO2_PER_KM[inp.commute_mode]
    )
    total = electricity + cooking + commute
    return FootprintBreakdown(
        electricity_kg=round(electricity, 1),
        cooking_kg=round(cooking, 1),
        commute_kg=round(commute, 1),
        total_kg=round(total, 1),
        per_capita_kg=round(total / max(inp.members, 1), 1),
    )


def electricity_bill_rs(
    kwh: float, discom: str = factors.DEFAULT_DISCOM, area: str = factors.DEFAULT_AREA
) -> float:
    """Monthly residential bill: telescopic energy slabs, fixed charge, FPPAS and electricity duty."""
    tariff = factors.TARIFFS.get((discom, area)) or factors.TARIFFS[(factors.DEFAULT_DISCOM, factors.DEFAULT_AREA)]
    energy, lower = 0.0, 0.0
    for upper, rate in tariff.slabs:
        if kwh <= lower:
            break
        energy += (min(kwh, upper) - lower) * rate
        lower = upper
    before_duty = energy + tariff.fixed_rs_per_month + kwh * tariff.fppas_rs_per_kwh
    return round(before_duty * (1 + tariff.duty_share), 2)
