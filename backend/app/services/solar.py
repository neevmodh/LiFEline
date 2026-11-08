"""Rooftop solar feasibility calculator."""

import logging
import math
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services import factors
from app.services.footprint import electricity_bill_rs

log = logging.getLogger(__name__)

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"


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


async def fetch_specific_yield(lat: float, lon: float) -> float | None:
    """Annual kWh per installed kWp at this location, from the EU JRC PVGIS model."""
    settings = get_settings()
    if not settings.enable_external_apis:
        return None
    params = {"lat": lat, "lon": lon, "peakpower": 1, "loss": 14, "outputformat": "json"}
    try:
        async with httpx.AsyncClient(timeout=settings.external_timeout_seconds) as client:
            resp = await client.get(PVGIS_URL, params=params)
            resp.raise_for_status()
            return float(resp.json()["outputs"]["totals"]["fixed"]["E_y"])
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("PVGIS lookup failed, using default yield: %s", exc)
        return None


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
) -> SolarEstimate:
    yield_source = "pvgis" if specific_yield else "default"
    specific_yield = specific_yield or factors.DEFAULT_SPECIFIC_YIELD_KWH_PER_KWP
    kwp, limited_by = size_system(roof_area_sqm, monthly_kwh, specific_yield)

    generation = kwp * specific_yield
    # Net metering: solar offsets the most expensive slabs first; any surplus is
    # credited at the export rate. Compare bills with and without solar.
    monthly_gen = generation / 12
    offset = min(monthly_gen, monthly_kwh)
    savings = 12 * (
        electricity_bill_rs(monthly_kwh, discom, area)
        - electricity_bill_rs(monthly_kwh - offset, discom, area)
        + (monthly_gen - offset) * factors.NET_METERING_EXPORT_RS_PER_KWH
    )
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
    )
