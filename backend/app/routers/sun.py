"""Real sunshine for all 33 districts: rooftop solar yield from the EU JRC PVGIS model.

Public, because it is not about any person. Fetched once per district and cached in the database,
so the GEDA map has real data under it from the first day, before a single citizen has signed up.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import select

from app.deps import DbSession
from app.models import District, DistrictSun
from app.services import solar

router = APIRouter(prefix="/api/sun", tags=["sun"])
MAX_AGE = timedelta(days=90)  # a climate figure: it does not change week to week


@router.get("/districts")
async def district_sun(db: DbSession):
    districts = db.scalars(select(District).order_by(District.name)).all()
    cached = {s.district_id: s for s in db.scalars(select(DistrictSun))}
    now = datetime.now(timezone.utc)
    stale = [d for d in districts if d.id not in cached or now - _aware(cached[d.id].fetched_at) > MAX_AGE]

    if stale:
        gate = asyncio.Semaphore(6)  # be polite to the free PVGIS service

        async def one(d: District):
            async with gate:
                return d, await solar.fetch_specific_yield(d.lat, d.lon)

        for d, value in await asyncio.gather(*(one(d) for d in stale)):
            if value is None:
                continue  # leave it out rather than invent one; the next call retries
            row = cached.get(d.id) or DistrictSun(district_id=d.id, kwh_per_kwp=value)
            row.kwh_per_kwp, row.fetched_at = value, now
            db.add(row)
            cached[d.id] = row
        db.commit()

    return [
        {"district_id": d.id, "district": d.name, "lat": d.lat, "lon": d.lon, "kwh_per_kwp": round(cached[d.id].kwh_per_kwp)}
        for d in districts if d.id in cached
    ]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
