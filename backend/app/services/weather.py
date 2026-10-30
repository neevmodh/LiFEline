"""Current outdoor temperature from Open-Meteo (free, no API key)."""

import logging
import time

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
_CACHE_TTL_SECONDS = 30 * 60
_cache: dict[tuple[float, float], tuple[float, float]] = {}


async def current_temperature(lat: float, lon: float) -> float | None:
    settings = get_settings()
    if not settings.enable_external_apis:
        return None

    key = (round(lat, 2), round(lon, 2))
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=settings.external_timeout_seconds) as client:
            resp = await client.get(
                OPEN_METEO_URL,
                params={"latitude": lat, "longitude": lon, "current": "temperature_2m"},
            )
            resp.raise_for_status()
            temp = float(resp.json()["current"]["temperature_2m"])
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("Open-Meteo lookup failed: %s", exc)
        return None

    _cache[key] = (time.monotonic(), temp)
    return temp
