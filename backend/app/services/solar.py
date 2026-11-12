"""Rooftop solar feasibility calculator."""

import logging
import math
import time
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services import factors
from app.services.footprint import electricity_bill_rs

log = logging.getLogger(__name__)

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"
PVGIS_CACHE_SECONDS = 24 * 60 * 60
_pvgis_cache: dict[tuple[float, float], tuple[float, tuple[float, list[float]]]] = {}

# Share of a year's output in each month for a fixed south-facing roof in Gujarat (PVGIS, Ahmedabad):
# strongest in March and April, weakest in the July-August monsoon. Used only when PVGIS is unreachable.
GUJARAT_MONTHLY_SHARE = (0.086, 0.088, 0.100, 0.100, 0.099, 0.080, 0.062, 0.063, 0.078, 0.088, 0.081, 0.075)

# How much of a roof is usable once shade from tanks, trees and neighbouring buildings is allowed for.
# A planning assumption shown to the user; an installer's survey gives the real figure.
SHADE_FACTOR = {"none": 1.0, "partial": 0.7, "heavy": 0.4}

# Share of the sunlight reaching a panel that ends up as electricity at the meter (inverter, heat,
# dust and wiring losses), used to turn the hourly radiation forecast into kWh.
PERFORMANCE_RATIO = 0.8


@dataclass(frozen=True)
class SolarEstimate:
    recommended_kwp: float
    limited_by: str  # "roof" or "consumption"
    specific_yield_kwh_per_kwp: float
    yield_source: str  # "pvgis" or "default"
    annual_generation_kwh: float
    annual_savings_rs: float
    gross_cost_rs: float
    subsidy_rs: float
    net_cost_rs: float
    payback_years: float | None
    annual_co2_avoided_kg: float
    lifetime_savings_rs: float
    usable_roof_sqm: float = 0.0
    shade: str = "none"
    bill_before_rs: float = 0.0  # a typical month without solar
    bill_after_rs: float = 0.0  # a typical month with solar, after export credit
    months: tuple["SolarMonth", ...] = ()


@dataclass(frozen=True)
class SolarMonth:
    month: int  # 1-12
    generation_kwh: float
    bill_before_rs: float
    bill_after_rs: float
    exported_kwh: float


async def fetch_pvgis(lat: float, lon: float) -> tuple[float, list[float]] | None:
    """Annual kWh per kWp and each month's kWh per kWp at this location (EU JRC PVGIS), cached a day."""
    settings = get_settings()
    if not settings.enable_external_apis:
        return None
    key = (round(lat, 2), round(lon, 2))
    hit = _pvgis_cache.get(key)
    if hit and time.monotonic() - hit[0] < PVGIS_CACHE_SECONDS:
        return hit[1]
    params = {"lat": lat, "lon": lon, "peakpower": 1, "loss": 14, "outputformat": "json"}
    try:
        async with httpx.AsyncClient(timeout=settings.external_timeout_seconds) as client:
            resp = await client.get(PVGIS_URL, params=params)
            resp.raise_for_status()
            outputs = resp.json()["outputs"]
            annual = float(outputs["totals"]["fixed"]["E_y"])
            monthly = [float(m["E_m"]) for m in sorted(outputs["monthly"]["fixed"], key=lambda m: m["month"])]
            if len(monthly) != 12:
                raise ValueError("PVGIS returned a partial year")
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        log.warning("PVGIS lookup failed, using default yield: %s", exc)
        return None
    _pvgis_cache[key] = (time.monotonic(), (annual, monthly))
    return annual, monthly


async def fetch_specific_yield(lat: float, lon: float) -> float | None:
    """Annual kWh per installed kWp at this location, from the EU JRC PVGIS model."""
    result = await fetch_pvgis(lat, lon)
    return result[0] if result else None


def monthly_shares(monthly_per_kwp: list[float] | None) -> tuple[float, ...]:
    """Each month's share of the year: from PVGIS when we have it, else Gujarat's typical profile."""
    if monthly_per_kwp and len(monthly_per_kwp) == 12 and sum(monthly_per_kwp) > 0:
        total = sum(monthly_per_kwp)
        return tuple(m / total for m in monthly_per_kwp)
    total = sum(GUJARAT_MONTHLY_SHARE)
    return tuple(m / total for m in GUJARAT_MONTHLY_SHARE)


def hourly_kwh_per_kwp(radiation_w_m2: dict[int, float]) -> dict[int, float]:
    """kWh one installed kW would make in each hour, from that hour's mean radiation (W/m²)."""
    return {h: round(max(r, 0) / 1000 * PERFORMANCE_RATIO, 3) for h, r in sorted(radiation_w_m2.items())}


def _lifetime_output_factor() -> float:
    """Sum of yearly output over the panel lifetime, accounting for degradation."""
    return sum((1 - factors.PANEL_DEGRADATION_PER_YEAR) ** year for year in range(factors.PANEL_LIFETIME_YEARS))


def size_system(
    roof_area_sqm: float, monthly_kwh: float, specific_yield: float = factors.DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP
) -> tuple[float, str]:
    """Recommended kWp and what limits it ("roof" or "consumption")."""
    roof_limit = roof_area_sqm / factors.SQM_PER_KWP
    # Sizing beyond annual consumption only exports surplus at a low feed-in rate.
    consumption_limit = monthly_kwh * 12 / specific_yield
    kwp = math.floor(min(roof_limit, consumption_limit) * 2) / 2  # installers sell in 0.5 kW steps
    return kwp, "roof" if roof_limit <= consumption_limit else "consumption"


def estimate(
    roof_area_sqm: float,
    monthly_kwh: float,
    specific_yield: float | None = None,
    discom: str = factors.DEFAULT_DISCOM,
    area: str = factors.DEFAULT_AREA,
    shade: str = "none",
    monthly_per_kwp: list[float] | None = None,
) -> SolarEstimate:
    yield_source = "pvgis" if specific_yield else "default"
    specific_yield = specific_yield or factors.DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP
    usable = roof_area_sqm * SHADE_FACTOR.get(shade, 1.0)
    kwp, limited_by = size_system(usable, monthly_kwh, specific_yield)

    generation = kwp * specific_yield
    # Net metering, month by month: solar offsets the dearest slabs first and any surplus is credited at
    # the export rate. The year's saving is the sum of the months, since the slab tariff isn't linear.
    months = []
    saved = 0.0
    for i, share in enumerate(monthly_shares(monthly_per_kwp)):
        gen = generation * share
        used = min(gen, monthly_kwh)
        exported = gen - used
        before = electricity_bill_rs(monthly_kwh, discom, area)
        after = max(0.0, electricity_bill_rs(monthly_kwh - used, discom, area) - exported * factors.NET_METERING_EXPORT_RS_PER_KWH)
        saved += before - (electricity_bill_rs(monthly_kwh - used, discom, area) - exported * factors.NET_METERING_EXPORT_RS_PER_KWH)
        months.append(SolarMonth(i + 1, round(gen), round(before), round(after), round(exported)))
    savings = saved
    gross = factors.solar_cost_rs(kwp)
    subsidy = factors.pm_surya_ghar_subsidy(kwp)
    net = gross - subsidy

    return SolarEstimate(
        recommended_kwp=kwp,
        limited_by=limited_by,
        specific_yield_kwh_per_kwp=round(specific_yield, 1),
        yield_source=yield_source,
        annual_generation_kwh=round(generation),
        annual_savings_rs=round(savings),
        gross_cost_rs=round(gross),
        subsidy_rs=round(subsidy),
        net_cost_rs=round(net),
        payback_years=round(net / savings, 1) if savings > 0 else None,
        annual_co2_avoided_kg=round(generation * factors.GRID_KG_CO2_PER_KWH),
        lifetime_savings_rs=round(savings * _lifetime_output_factor() - net),
        usable_roof_sqm=round(usable, 1),
        shade=shade if shade in SHADE_FACTOR else "none",
        bill_before_rs=round(sum(m.bill_before_rs for m in months) / 12),
        bill_after_rs=round(sum(m.bill_after_rs for m in months) / 12),
        months=tuple(months),
    )
