"""Green Hours: the cleanest time to run heavy appliances, from tomorrow's real solar forecast.

Gujarat has the most rooftop and utility solar of any state, so the grid is cleanest
when the sun is strongest, and dirtiest in the evening peak. Fixed "solar hours" are
right on a clear winter day and wrong on a monsoon one, so LiFEline reads the hourly
solar radiation forecast for the user's district (Open-Meteo, free, no key) and picks
the sunniest few hours outside the evening peak.

`best_window` is pure and tested; `green_hours` adds the cached forecast lookup.
"""

import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta

import httpx

from app.config import get_settings
from app.services import factors

log = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_SECONDS = 60 * 60
WINDOW_HOURS = 3
SUNNY_W_M2 = 450  # average radiation over the window
CLOUDY_W_M2 = 200
_cache: dict[tuple[float, float], tuple[float, dict[datetime, float]]] = {}


@dataclass(frozen=True)
class Window:
    day: date
    start_hour: int  # window covers [start_hour, end_hour)
    end_hour: int
    avg_radiation_w_m2: float
    sky: str  # sunny | partly_cloudy | cloudy


def best_window(radiation: dict[datetime, float], day: date, after_hour: int = 0) -> Window | None:
    """Sunniest WINDOW_HOURS-long stretch of `day` that starts at or after `after_hour`
    and doesn't overlap the evening peak. `radiation` maps the start of each hour (local
    time) to that hour's mean shortwave radiation in W/m²."""
    peak_start, peak_end = factors.PEAK_HOURS
    by_hour = {t.hour: r for t, r in radiation.items() if t.date() == day}
    best: Window | None = None
    for start in range(max(after_hour, 6), 20 - WINDOW_HOURS + 1):
        end = start + WINDOW_HOURS
        if start < peak_end and end > peak_start:
            continue
        values = [by_hour.get(h) for h in range(start, end)]
        if any(v is None for v in values):
            continue
        avg = sum(values) / WINDOW_HOURS
        if avg <= 0:
            continue
        if best is None or avg > best.avg_radiation_w_m2:
            sky = "sunny" if avg >= SUNNY_W_M2 else "cloudy" if avg < CLOUDY_W_M2 else "partly_cloudy"
            best = Window(day, start, end, round(avg), sky)
    return best


async def _forecast(lat: float, lon: float) -> dict[datetime, float]:
    key = (round(lat, 2), round(lon, 2))
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    params = {"latitude": lat, "longitude": lon, "hourly": "shortwave_radiation", "timezone": "Asia/Kolkata",
              "forecast_days": 2}
    async with httpx.AsyncClient(timeout=get_settings().external_timeout_seconds) as client:
        resp = await client.get(FORECAST_URL, params=params)
        resp.raise_for_status()
        hourly = resp.json()["hourly"]
    # Open-Meteo reports each hour's value at its end ("preceding hour mean"); key by the hour's start.
    data = {
        datetime.fromisoformat(t) - timedelta(hours=1): float(r)
        for t, r in zip(hourly["time"], hourly["shortwave_radiation"], strict=True)
        if r is not None
    }
    _cache[key] = (time.monotonic(), data)
    return data


async def window_from_now(lat: float, lon: float, now: datetime) -> Window | None:
    """Today's sunniest window starting this hour or later (for alerts at the start of the window)."""
    if not get_settings().enable_external_apis:
        return None
    try:
        radiation = await _forecast(lat, lon)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("Open-Meteo forecast failed: %s", exc)
        return None
    return best_window(radiation, now.date(), after_hour=now.hour)


async def green_hours(lat: float, lon: float, now: datetime) -> tuple[Window | None, Window | None]:
    """(rest of today, tomorrow). Either is None if there's no usable sunshine or no forecast."""
    if not get_settings().enable_external_apis:
        return None, None
    try:
        radiation = await _forecast(lat, lon)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("Open-Meteo forecast failed: %s", exc)
        return None, None
    today = now.date()
    return best_window(radiation, today, after_hour=now.hour + 1), best_window(radiation, today + timedelta(days=1))
