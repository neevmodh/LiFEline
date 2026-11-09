from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from sqlalchemy import func, select

from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.i18n import RequestLocale
from app.models import ActionLog, ActionStatus, ActionType, EnergyReading, Household
from app.ratelimit import bill_scan_limiter
from app.routers.actions import daily_challenge_for
from app.routers.auth import user_out
from app.schemas import (
    BadgeOut,
    BillScanOut,
    DashboardOut,
    FootprintHistoryOut,
    FootprintIn,
    FootprintMonthOut,
    FootprintOut,
    FootprintPreviewIn,
    HouseholdIn,
    HouseholdOut,
    LevelOut,
    OnboardingOut,
    ReadingIn,
    ReadingOut,
    TrendPoint,
)
from app.services import factors
from app.services.badges import History, badges_for
from app.services.bill_scan import BillScanFailed, BillScanUnavailable, scan_bill
from app.services.footprint import (
    FootprintInput,
    electricity_bill_rs,
    monthly_footprint,
)
from app.services.gamification import level_for
from app.services.share_card import render_card
from app.services.stats import COUNTED_STATUSES, streak_days, user_ranking, user_totals
from app.timeutil import IST, as_utc, today_ist
from app.uploads import read_image

router = APIRouter(prefix="/api", tags=["footprint"])


def _footprint(body: FootprintIn, discom: str = "ugvcl", area: str = "urban") -> FootprintOut:
    breakdown = monthly_footprint(
        FootprintInput(
            monthly_kwh=body.monthly_kwh,
            members=body.members,
            lpg_cylinders_per_month=body.lpg_cylinders_per_month,
            commute_mode=body.commute_mode,
            commute_km_per_day=body.commute_km_per_day,
        )
    )
    return FootprintOut(**breakdown.__dict__, monthly_bill_rs=electricity_bill_rs(body.monthly_kwh, discom, area))


def _household_footprint(household: Household) -> FootprintOut:
    return _footprint(FootprintIn.model_validate(household, from_attributes=True), household.discom, household.area)


def _require_household(user) -> Household:
    if user.household is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Complete onboarding first")
    return user.household


@router.post("/footprint/preview", response_model=FootprintOut)
def preview_footprint(body: FootprintPreviewIn):
    """Unauthenticated, so the onboarding wizard can update live as the user types."""
    return _footprint(body, body.discom, body.area)


@router.put("/household", response_model=OnboardingOut)
def upsert_household(body: HouseholdIn, user: CurrentUser, db: DbSession):
    footprint = _footprint(body, body.discom, body.area)
    household = user.household or Household(user_id=user.id)
    for field, value in body.model_dump().items():
        setattr(household, field, value)
    household.baseline_kg_co2_month = footprint.total_kg
    db.add(household)

    # The onboarding answer doubles as this month's first reading.
    this_month = today_ist().replace(day=1)
    exists = db.scalar(
        select(EnergyReading).where(EnergyReading.user_id == user.id, EnergyReading.month == this_month)
    )
    if not exists:
        db.add(EnergyReading(user_id=user.id, month=this_month, kwh=body.monthly_kwh, source="onboarding"))
    db.commit()
    db.refresh(user)
    return OnboardingOut(household=HouseholdOut.model_validate(household), footprint=footprint)


@router.get("/household", response_model=OnboardingOut)
def get_household(user: CurrentUser):
    household = _require_household(user)
    footprint = _household_footprint(household)
    return OnboardingOut(household=HouseholdOut.model_validate(household), footprint=footprint)


def _reading_out(reading: EnergyReading, household: Household) -> ReadingOut:
    baseline_kwh = household.monthly_kwh
    change = (reading.kwh - baseline_kwh) / baseline_kwh * 100 if baseline_kwh else 0.0
    return ReadingOut(
        month=reading.month.strftime("%Y-%m"),
        kwh=reading.kwh,
        kg_co2=round(reading.kwh * factors.GRID_KG_CO2_PER_KWH, 1),
        bill_rs=electricity_bill_rs(reading.kwh, household.discom, household.area),
        change_vs_baseline_pct=round(change, 1),
    )


@router.get("/readings", response_model=list[ReadingOut])
def list_readings(user: CurrentUser, db: DbSession):
    household = _require_household(user)
    readings = db.scalars(
        select(EnergyReading).where(EnergyReading.user_id == user.id).order_by(EnergyReading.month)
    ).all()
    return [_reading_out(r, household) for r in readings]


@router.post("/readings", response_model=ReadingOut)
def upsert_reading(body: ReadingIn, user: CurrentUser, db: DbSession):
    household = _require_household(user)
    year, month = map(int, body.month.split("-"))
    month_date = date(year, month, 1)
    if month_date > today_ist().replace(day=1):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Cannot log a future month")

    reading = db.scalar(
        select(EnergyReading).where(EnergyReading.user_id == user.id, EnergyReading.month == month_date)
    )
    if reading:
        reading.kwh, reading.source = body.kwh, "manual"
    else:
        reading = EnergyReading(user_id=user.id, month=month_date, kwh=body.kwh, source="manual")
        db.add(reading)
    db.commit()
    return _reading_out(reading, household)


@router.get("/share/card.png")
def share_card(user: CurrentUser, db: DbSession):
    """The citizen's own impact as a 1080x1080 image to share. First name and district only."""
    _require_household(user)
    points, co2, _, actions = user_totals(db, user.id)
    _, title, _ = level_for(points)
    site = next((o for o in get_settings().cors_origins if o.startswith("https://")), "lifeline")
    png = render_card(
        first_name=user.name.split()[0],
        district=user.district.name if user.district else None,
        co2_kg=co2,
        km_not_driven=co2 / factors.COMMUTE_KG_CO2_PER_KM["car"],
        actions=actions,
        streak_days=streak_days(db, user.id, today_ist()),
        level_title=title,
        site=site.removeprefix("https://"),
    )
    return Response(png, media_type="image/png", headers={"Cache-Control": "private, no-store"})


@router.get("/badges", response_model=list[BadgeOut])
def badges(user: CurrentUser, db: DbSession):
    rows = db.execute(
        select(ActionType.code, ActionLog.status, ActionLog.co2_saved_kg, ActionLog.created_at)
        .join(ActionType, ActionType.id == ActionLog.action_type_id)
        .where(ActionLog.user_id == user.id, ActionLog.status.in_(COUNTED_STATUSES))
    ).all()
    counted: dict[str, int] = {}
    verified: dict[str, int] = {}
    for r in rows:
        counted[r.code] = counted.get(r.code, 0) + 1
        if r.status == ActionStatus.verified:
            verified[r.code] = verified.get(r.code, 0) + 1
    bills = db.scalar(
        select(func.count(EnergyReading.id)).where(EnergyReading.user_id == user.id, EnergyReading.source != "onboarding")
    )
    history = History(
        counted_by_code=counted,
        verified_by_code=verified,
        co2_avoided_kg=sum(r.co2_saved_kg for r in rows),
        action_days={as_utc(r.created_at).astimezone(IST).date() for r in rows},
        bills=bills or 0,
    )
    return [BadgeOut(**b.__dict__) for b in badges_for(history)]


@router.get("/footprint/history", response_model=FootprintHistoryOut)
def footprint_history(user: CurrentUser, db: DbSession):
    """Monthly footprint for every month with a bill, against the onboarding baseline.

    Electricity comes from that month's reading; cooking and commute from the household's
    current answers. Savings from logged actions are reported alongside, not subtracted,
    because electricity savings already show up in the bill.
    """
    household = _require_household(user)
    fp = _household_footprint(household)
    readings = db.scalars(
        select(EnergyReading).where(EnergyReading.user_id == user.id).order_by(EnergyReading.month.desc()).limit(12)
    ).all()
    since = min((r.month for r in readings), default=today_ist().replace(day=1))
    avoided: dict[str, tuple[float, int]] = {}
    for created_at, co2 in db.execute(
        select(ActionLog.created_at, ActionLog.co2_saved_kg).where(
            ActionLog.user_id == user.id,
            ActionLog.status.in_(COUNTED_STATUSES),
            ActionLog.created_at >= as_utc(datetime.combine(since, datetime.min.time(), tzinfo=IST)),
        )
    ):
        key = as_utc(created_at).astimezone(IST).strftime("%Y-%m")
        kg, n = avoided.get(key, (0.0, 0))
        avoided[key] = (kg + co2, n + 1)

    months = []
    for r in reversed(readings):
        key = r.month.strftime("%Y-%m")
        electricity = round(r.kwh * factors.GRID_KG_CO2_PER_KWH, 1)
        kg, n = avoided.get(key, (0.0, 0))
        months.append(
            FootprintMonthOut(
                month=key,
                electricity_kg=electricity,
                cooking_kg=fp.cooking_kg,
                commute_kg=fp.commute_kg,
                total_kg=round(electricity + fp.cooking_kg + fp.commute_kg, 1),
                avoided_kg=round(kg, 1),
                actions=n,
            )
        )
    return FootprintHistoryOut(baseline_kg=household.baseline_kg_co2_month, months=months)


@router.post("/bills/scan", response_model=BillScanOut)
async def scan_bill_photo(user: CurrentUser, photo: Annotated[UploadFile, File()]):
    """Read units from a bill photo with a vision model. 503 tells the client to read it on-device instead."""
    checked = await read_image(photo)
    bill_scan_limiter.check(str(user.id))
    try:
        result = await scan_bill(checked.data, checked.media_type)
    except BillScanUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except BillScanFailed as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    reading = result.reading
    return BillScanOut(**reading.__dict__, monthly_kwh=reading.monthly_kwh, provider=result.provider)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: CurrentUser, db: DbSession, locale: RequestLocale):
    household = _require_household(user)
    today = today_ist()
    points, co2_saved, kwh_saved, actions = user_totals(db, user.id)
    level, title, next_at = level_for(points)

    ranking = user_ranking(db, "month", district_id=user.district_id)
    rank = next((i + 1 for i, row in enumerate(ranking) if row.id == user.id), None)

    readings = db.scalars(
        select(EnergyReading)
        .where(EnergyReading.user_id == user.id)
        .order_by(EnergyReading.month.desc())
        .limit(12)
    ).all()
    trend = [
        TrendPoint(
            month=r.month.strftime("%Y-%m"),
            kwh=r.kwh,
            kg_co2=round(r.kwh * factors.GRID_KG_CO2_PER_KWH, 1),
        )
        for r in reversed(readings)
    ]

    return DashboardOut(
        user=user_out(user),
        footprint=_household_footprint(household),
        level=LevelOut(level=level, title=title, points=points, next_level_at=next_at),
        streak_days=streak_days(db, user.id, today),
        actions_logged=actions,
        co2_saved_kg=co2_saved,
        kwh_saved=kwh_saved,
        district_rank=rank,
        district_participants=len(ranking),
        trend=trend,
        daily_challenge=daily_challenge_for(db, user.id, today, household, locale),
    )
