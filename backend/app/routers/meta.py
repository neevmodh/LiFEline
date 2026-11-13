"""Public reference data: the assumptions behind every number the app shows."""

from fastapi import APIRouter, BackgroundTasks, Response

from app.i18n import RequestLocale
from app.schemas import ConfigOut, DiscomOut, SourceOut
from app.services import factors
from app.services.translate import localize

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/config", response_model=ConfigOut)
def config(response: Response, locale: RequestLocale, background: BackgroundTasks):
    response.headers["Cache-Control"] = "public, max-age=3600"
    response.headers["Vary"] = "Accept-Language"
    sources = [dict(s) for s in factors.SOURCES]
    if locale != "en":  # the sources table reads in the reader's language once Sarvam has translated it
        texts = [s[f] for s in sources for f in ("topic", "value", "source")]
        done = iter(localize(texts, locale, background))
        for s in sources:
            for f in ("topic", "value", "source"):
                s[f] = next(done)
    names = list(factors.DISCOMS.items())
    discom_names = localize([n for _, n in names], locale, background) if locale != "en" else [n for _, n in names]
    return ConfigOut(
        peak_hours=factors.PEAK_HOURS,
        solar_hours=factors.SOLAR_HOURS,
        sqm_per_kwp=factors.SQM_PER_KWP,
        grid_kg_co2_per_kwh=factors.GRID_KG_CO2_PER_KWH,
        car_kg_co2_per_km=factors.COMMUTE_KG_CO2_PER_KM["car"],
        tree_kg_co2_per_year=factors.TREE_KG_CO2_PER_YEAR,
        discoms=[DiscomOut(code=code, name=n) for (code, _), n in zip(names, discom_names)],
        sources=[SourceOut(**s) for s in sources],
    )
