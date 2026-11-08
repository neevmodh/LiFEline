"""Public reference data: the assumptions behind every number the app shows."""

from fastapi import APIRouter

from app.schemas import ConfigOut, DiscomOut, SourceOut
from app.services import factors

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/config", response_model=ConfigOut)
def config():
    return ConfigOut(
        peak_hours=factors.PEAK_HOURS,
        solar_hours=factors.SOLAR_HOURS,
        sqm_per_kwp=factors.SQM_PER_KWP,
        grid_kg_co2_per_kwh=factors.GRID_KG_CO2_PER_KWH,
        discoms=[DiscomOut(code=code, name=name) for code, name in factors.DISCOMS.items()],
        sources=[SourceOut(**s) for s in factors.SOURCES],
    )
