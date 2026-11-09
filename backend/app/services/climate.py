"""Observed monthly weather per district, from the Open-Meteo historical archive.

Cooling degree days (CDD) measure how hot a month was in the way that drives AC
and fan use: for each day, how many degrees the mean temperature was above 24°C
(the BEE-recommended AC set-point), summed over the month. Completed months are
cached in the database; the month in progress is refreshed as days arrive.
"""

import calendar
import logging
from datetime import date, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import ClimateMonth, District

log = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
CDD_BASE_C = 24.0


def days_in_month(month: date) -> int:
    return calendar.monthrange(month.year, month.month)[1]


def monthly_from_daily(days: list[str], temps: list[float | None]) -> dict[date, tuple[float, float, int]]:
    """Daily mean temperatures -> {month: (CDD scaled to the full month, mean temp, days observed)}."""
    acc: dict[date, list[float]] = {}
    for day, temp in zip(days, temps, strict=True):
        if temp is None:
            continue
        acc.setdefault(date.fromisoformat(day).replace(day=1), []).append(temp)
    out = {}
    for month, values in acc.items():
        daily_cdd = sum(max(t - CDD_BASE_C, 0.0) for t in values) / len(values)
        out[month] = (round(daily_cdd * days_in_month(month), 1), round(sum(values) / len(values), 1), len(values))
    return out


async def _fetch(lat: float, lon: float, start: date, end: date) -> dict[date, tuple[float, float, int]]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "daily": "temperature_2m_mean",
        "timezone": "Asia/Kolkata",
    }
    async with httpx.AsyncClient(timeout=get_settings().external_timeout_seconds) as client:
        resp = await client.get(ARCHIVE_URL, params=params)
        resp.raise_for_status()
        daily = resp.json()["daily"]
    return monthly_from_daily(daily["time"], daily["temperature_2m_mean"])


async def monthly_cdd(db: Session, district: District, months: list[date]) -> dict[date, float]:
    """CDD for each requested month (1st-of-month dates) that has observations."""
    if not months:
        return {}
    cached = {
        row.month: row
        for row in db.scalars(
            select(ClimateMonth).where(ClimateMonth.district_id == district.id, ClimateMonth.month.in_(months))
        )
    }
    stale = [m for m in months if m not in cached or cached[m].days_observed < days_in_month(m)]
    if stale and get_settings().enable_external_apis:
        # The archive lags real time by a few days; ask up to yesterday.
        end = min(max(stale).replace(day=days_in_month(max(stale))), date.today() - timedelta(days=1))
        start = min(stale)
        if start <= end:
            try:
                fetched = await _fetch(district.lat, district.lon, start, end)
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                log.warning("Open-Meteo archive lookup failed: %s", exc)
                fetched = {}
            for month, (cdd, mean_temp, days) in fetched.items():
                row = cached.get(month) or ClimateMonth(district_id=district.id, month=month)
                row.cooling_degree_days, row.mean_temp_c, row.days_observed = cdd, mean_temp, days
                db.add(row)
                cached[month] = row
            db.commit()
    return {m: cached[m].cooling_degree_days for m in months if m in cached}
