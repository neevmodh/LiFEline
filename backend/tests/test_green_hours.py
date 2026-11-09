"""Green Hours: picking the sunniest hours outside the evening peak from a real-shaped forecast."""

from datetime import date, datetime, timedelta

from app.services import green_hours as gh
from app.services.green_hours import best_window
from app.services.nudges import NudgeContext, generate_nudges

DAY = date(2026, 11, 10)
# Surat, clear November day (Open-Meteo, W/m², keyed by the hour's start).
CLEAR = [0, 25, 177, 374, 551, 678, 741, 732, 652, 504, 317, 124, 8, 0]  # 06:00 ... 19:00


def forecast(values, day=DAY, first_hour=6):
    return {datetime(day.year, day.month, day.day, first_hour + i): float(v) for i, v in enumerate(values)}


def test_clear_day_picks_midday():
    w = best_window(forecast(CLEAR), DAY)
    assert (w.start_hour, w.end_hour) == (11, 14) and w.sky == "sunny"
    assert w.avg_radiation_w_m2 == round((678 + 741 + 732) / 3)  # 11:00, 12:00, 13:00


def test_cloudy_midday_moves_the_window():
    cloudy_noon = CLEAR.copy()
    cloudy_noon[4:8] = [120, 90, 100, 140]  # 10:00-14:00 under monsoon cloud
    w = best_window(forecast(cloudy_noon), DAY)
    assert w.start_hour >= 14 and w.end_hour <= 18


def test_window_never_touches_the_evening_peak():
    late_sun = [0] * 10 + [900, 900, 900, 900]  # only sunny 16:00-19:00
    w = best_window(forecast(late_sun), DAY)
    assert w is None or w.end_hour <= 18


def test_today_only_offers_hours_still_ahead():
    w = best_window(forecast(CLEAR), DAY, after_hour=14)
    assert w.start_hour >= 14


def test_overcast_day_is_labelled_cloudy_and_night_has_no_window():
    w = best_window(forecast([v * 0.2 for v in CLEAR]), DAY)
    assert w.sky == "cloudy"
    assert best_window(forecast([0] * 14), DAY) is None


def test_forecast_window_replaces_fixed_solar_hours_in_nudges():
    ctx = NudgeContext(now=datetime(2026, 11, 10, 12, 30), ac_count=0, has_geyser=True, has_washing_machine=True,
                       has_ev=False, has_solar=False, commute_mode="bus", commute_km_per_day=5, baseline_kwh=200,
                       green_today=(12, 15))
    nudge = next(n for n in generate_nudges(ctx) if n.code == "solar_window")
    assert "12:00 and 15:00" in nudge.body


def test_endpoint_returns_today_and_tomorrow(client, citizen, monkeypatch):
    async def fake_forecast(lat, lon):
        today = datetime(2026, 11, 10).date()
        return {**forecast(CLEAR, today), **forecast(CLEAR, today + timedelta(days=1))}

    monkeypatch.setattr(gh, "_forecast", fake_forecast)
    monkeypatch.setattr(gh.get_settings(), "enable_external_apis", True)
    monkeypatch.setattr("app.routers.insights.now_ist", lambda: datetime(2026, 11, 10, 8, 0))
    data = client.get("/api/insights/green-hours", headers=citizen).json()
    assert data["today"]["start_hour"] == 11 and data["tomorrow"]["date"] == "2026-11-11"
    assert data["peak_hours"] == [18, 22]


def test_endpoint_without_forecast_degrades_gracefully(client, citizen):
    data = client.get("/api/insights/green-hours", headers=citizen).json()
    assert data["today"] is None and data["tomorrow"] is None
