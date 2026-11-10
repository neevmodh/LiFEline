"""Monthly PDF report for the signed-in citizen."""

import re
from datetime import date

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import ActionLog, District, EnergyReading, Household
from app.services import factors
from app.services.footprint import electricity_bill_rs
from app.services.report import ReportData, render_report
from app.services.stats import COUNTED_STATUSES
from app.timeutil import ist_day_bounds_utc, today_ist

router = APIRouter(prefix="/api/report", tags=["report"])


def _bounds(month: date):
    nxt = date(month.year + (month.month == 12), month.month % 12 + 1, 1)
    return ist_day_bounds_utc(month)[0], ist_day_bounds_utc(nxt)[0]


@router.get("/monthly.pdf")
def monthly_pdf(user: CurrentUser, db: DbSession, month: str | None = Query(default=None, description="YYYY-MM")):
    if month and not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Month looks like 2026-11")
    first = date(int(month[:4]), int(month[5:]), 1) if month else today_ist().replace(day=1)
    h = db.scalar(select(Household).where(Household.user_id == user.id))
    if h is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Finish your household profile first")

    reading = db.scalar(select(EnergyReading).where(EnergyReading.user_id == user.id, EnergyReading.month == first))
    start, end = _bounds(first)
    actions, co2, kwh, points = db.execute(
        select(func.count(ActionLog.id), func.coalesce(func.sum(ActionLog.co2_saved_kg), 0.0),
               func.coalesce(func.sum(ActionLog.kwh_saved), 0.0), func.coalesce(func.sum(ActionLog.points_awarded), 0))
        .where(ActionLog.user_id == user.id, ActionLog.status.in_(COUNTED_STATUSES),
               ActionLog.created_at >= start, ActionLog.created_at < end)
    ).one()
    district = db.get(District, user.district_id).name if user.district_id else "Gujarat"
    change = (reading.kwh - h.monthly_kwh) / h.monthly_kwh * 100 if reading and h.monthly_kwh else None
    pdf = render_report(ReportData(
        name=user.name.split()[0], month_label=first.strftime("%B %Y"), district=district,
        discom=factors.DISCOMS.get(h.discom, h.discom).split("(")[-1].rstrip(")"),
        kwh=reading.kwh if reading else None,
        bill_rs=electricity_bill_rs(reading.kwh, h.discom, h.area) if reading else None,
        kg_co2=round(reading.kwh * factors.GRID_KG_CO2_PER_KWH, 1) if reading else None,
        baseline_kwh=h.monthly_kwh, change_pct=round(change, 1) if change is not None else None,
        actions=actions, action_co2_kg=float(co2), action_kwh=float(kwh), points=int(points),
    ))
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="nidhi-{first:%Y-%m}.pdf"', "Cache-Control": "private, no-store"})
