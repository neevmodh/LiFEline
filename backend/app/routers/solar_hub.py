"""Solar beyond the calculator: today's output for a roof, and site-survey requests that GEDA follows up.

- GET  /api/solar/today?district_id=  what one installed kW would make today, hour by hour (Open-Meteo)
- POST /api/solar/leads               a household asks GEDA for a site survey (consent to be contacted)
- GET  /api/solar/leads/mine          where that request has got to
- GET  /api/admin/solar-leads         GEDA's queue, by district for officers, contact details for those who act
- PATCH /api/admin/solar-leads/{id}   move a request along: new, contacted, survey_done, quoted, installed, dropped
"""

from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.config import get_settings
from app.deps import AdminUser, CurrentUser, DbSession, district_scope
from app.models import District, Role, SolarLead, User
from app.schemas import AdminSolarLeadOut, SolarLeadIn, SolarLeadOut, SolarLeadUpdate, SolarTodayOut
from app.services import green_hours, solar
from app.timeutil import now_ist

router = APIRouter(prefix="/api", tags=["solar"])

OPEN = ("new", "contacted", "survey_done", "quoted")
SUNNY_KWH, CLOUDY_KWH = 4.5, 2.5  # kWh per kWp in a day


def sky_for(kwh_per_kwp: float) -> str:
    return "sunny" if kwh_per_kwp >= SUNNY_KWH else "cloudy" if kwh_per_kwp < CLOUDY_KWH else "partly_cloudy"


@router.get("/solar/today", response_model=SolarTodayOut)
async def solar_today(db: DbSession, district_id: int = Query(ge=1)):
    """What a 1 kW rooftop system in this district would make today, hour by hour, from the solar forecast."""
    district = db.get(District, district_id)
    if district is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown district")
    now = now_ist()
    hours: dict[int, float] = {}
    if get_settings().enable_external_apis:
        try:
            radiation = await green_hours._forecast(district.lat, district.lon)  # noqa: SLF001 (shared, cached)
            hours = solar.hourly_kwh_per_kwp({t.hour: r for t, r in radiation.items() if t.date() == now.date()})
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            green_hours.log.warning("Solar today: forecast unavailable: %s", exc)
    total = round(sum(hours.values()), 2)
    best = max(hours, key=lambda h: hours[h]) if hours and total > 0 else None
    return SolarTodayOut(district=district.name, date=now.date().isoformat(), hours={h: v for h, v in hours.items() if v > 0},
                         kwh_per_kwp=total, best_hour=best, sky=sky_for(total) if hours else "unknown")


def _open_lead(db, user_id: int) -> SolarLead | None:
    return db.scalar(select(SolarLead).where(SolarLead.user_id == user_id, SolarLead.status.in_(OPEN)))


@router.post("/solar/leads", response_model=SolarLeadOut, status_code=status.HTTP_201_CREATED)
def request_survey(body: SolarLeadIn, user: CurrentUser, db: DbSession):
    """Ask GEDA for a rooftop solar site survey. One open request at a time."""
    if user.role != Role.citizen:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Survey requests come from households")
    if _open_lead(db, user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a survey request in progress")
    lead = SolarLead(user_id=user.id, district_id=user.district_id, kwp=body.kwp, roof_area_sqm=body.roof_area_sqm,
                     monthly_kwh=body.monthly_kwh, note=body.note.strip())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/solar/leads/mine", response_model=SolarLeadOut | None)
def my_survey(user: CurrentUser, db: DbSession):
    """The household's latest request, open or not, or nothing."""
    return db.scalar(select(SolarLead).where(SolarLead.user_id == user.id).order_by(SolarLead.id.desc()).limit(1))


def _admin_out(lead: SolarLead, person: User, district: str | None, show_contact: bool) -> AdminSolarLeadOut:
    return AdminSolarLeadOut(
        **SolarLeadOut.model_validate(lead).model_dump(),
        name=person.name.split()[0] if not show_contact else person.name,
        email=person.email if show_contact else "",
        phone=person.phone if show_contact else None,
        district=district,
        staff_note=lead.staff_note,
    )


@router.get("/admin/solar-leads", response_model=dict)
def admin_leads(staff: AdminUser, db: DbSession, district_id: int | None = None, lead_status: str | None = Query(None, alias="status")):
    """The survey queue with counts at each stage. Auditors see the queue without contact details."""
    scope = district_scope(staff, district_id)
    q = select(SolarLead, User, District.name).join(User, User.id == SolarLead.user_id).outerjoin(
        District, District.id == SolarLead.district_id)
    counts_q = select(SolarLead.status, func.count(SolarLead.id)).group_by(SolarLead.status)
    if scope is not None:
        q = q.where(SolarLead.district_id == scope)
        counts_q = counts_q.where(SolarLead.district_id == scope)
    if lead_status:
        q = q.where(SolarLead.status == lead_status)
    rows = db.execute(q.order_by(SolarLead.created_at.desc()).limit(300)).all()
    show_contact = staff.role in (Role.admin, Role.officer)
    counts = {s: 0 for s in ("new", "contacted", "survey_done", "quoted", "installed", "dropped")}
    counts.update(dict(db.execute(counts_q).all()))
    return {
        "counts": counts,
        "kwp_requested": round(sum(lead.kwp for lead, _, _ in rows if lead.status != "dropped"), 1),
        "leads": [_admin_out(lead, person, district, show_contact).model_dump(mode="json") for lead, person, district in rows],
    }


@router.patch("/admin/solar-leads/{lead_id}", response_model=AdminSolarLeadOut)
def update_lead(lead_id: int, body: SolarLeadUpdate, staff: AdminUser, db: DbSession):
    """Move a request along the pipeline. The state team and district officers only (auditors read)."""
    if staff.role not in (Role.admin, Role.officer):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the state team and district officers update requests")
    lead = db.get(SolarLead, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such request")
    # Officers: their own district only (a request with no district belongs to the state team).
    if staff.role == Role.officer and lead.district_id != staff.district_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only update requests in your own district")
    lead.status = body.status
    if body.staff_note is not None:
        lead.staff_note = body.staff_note.strip()
    lead.updated_at = datetime.now().astimezone()
    db.commit()
    person = db.get(User, lead.user_id)
    district = db.get(District, lead.district_id).name if lead.district_id else None
    return _admin_out(lead, person, district, True)
