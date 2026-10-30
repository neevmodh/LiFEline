from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    return datetime.now(IST)


def today_ist() -> date:
    return now_ist().date()


def as_utc(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; everything is stored in UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def ist_day_bounds_utc(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=IST).astimezone(timezone.utc)
    return start, start + timedelta(days=1)


def month_start(d: date) -> date:
    return d.replace(day=1)
