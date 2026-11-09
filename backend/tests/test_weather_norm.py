"""Weather-adjusted savings: the regression, the climate cache and the endpoint."""

from datetime import date

import pytest
from conftest import register

from app.services import climate
from app.services.climate import monthly_from_daily
from app.services.weather_norm import (
    Point,
    adjust,
    choose_model,
    household_slope,
    pooled_slope,
)

# Surat's observed cooling degree days (Open-Meteo archive, 2026), used as realistic weather.
SURAT = {date(2026, 4, 1): 212.4, date(2026, 5, 1): 263.3, date(2026, 6, 1): 213.1,
         date(2026, 7, 1): 109.4, date(2026, 8, 1): 111.8, date(2026, 9, 1): 128.8}


def pts(base: float, slope: float, months=SURAT, noise=None) -> list[Point]:
    noise = noise or {}
    return [Point(m, base + slope * c + noise.get(m, 0), c) for m, c in months.items()]


def test_slope_recovered_from_a_households_bills():
    assert household_slope(pts(150, 0.8)) == pytest.approx(0.8)


def test_too_few_months_or_too_little_weather_change_gives_no_slope():
    assert household_slope(pts(150, 0.8)[:2]) is None
    flat = {date(2026, 7, 1): 109.4, date(2026, 8, 1): 111.8, date(2026, 9, 1): 120.0}
    assert household_slope(pts(150, 0.8, flat)) is None


def test_negative_fit_is_clipped_to_zero():
    assert household_slope(pts(400, -0.5)) == 0.0


def test_pooled_slope_ignores_each_households_base_load():
    slope, used = pooled_slope([pts(100, 0.5), pts(300, 0.5), pts(220, 0.5)])
    assert slope == pytest.approx(0.5) and used == 3


def test_model_falls_back_from_household_to_district_to_state():
    two_months = pts(150, 0.8)[:2]
    district = [pts(100, 0.6), pts(200, 0.6), pts(250, 0.6)]
    assert choose_model(pts(150, 0.8), district, district).source == "household"
    assert choose_model(two_months, district, district).source == "district"
    assert choose_model(two_months, [], district).source == "state"
    assert choose_model(two_months, [], []).source == "none"


def test_cooler_month_is_not_mistaken_for_saving():
    # Baseline: May (hot) at 360 kWh. In July the household changed nothing.
    slope = 0.8
    may, july = date(2026, 5, 1), date(2026, 7, 1)
    baseline = Point(may, 150 + slope * SURAT[may], SURAT[may])
    model = choose_model(pts(150, slope), [], [])
    [july_adj] = adjust([Point(july, 150 + slope * SURAT[july], SURAT[july])], baseline, model)
    # Raw bills show a 23% drop; adjusted for weather the saving is zero.
    assert july_adj.saving_pct == pytest.approx(0.0, abs=0.1)
    assert july_adj.expected_kwh == pytest.approx(july_adj.kwh, abs=0.1)


def test_real_saving_and_overuse_are_measured_against_the_weather():
    may, june = date(2026, 5, 1), date(2026, 6, 1)
    baseline = Point(may, 360, SURAT[may])
    model = choose_model(pts(150, 0.8), [], [])
    expected_june = 360 + 0.8 * (SURAT[june] - SURAT[may])
    [saved] = adjust([Point(june, expected_june * 0.9, SURAT[june])], baseline, model)
    assert saved.saving_pct == pytest.approx(10.0, abs=0.1) and not saved.above_expected
    [over] = adjust([Point(june, expected_june * 1.2, SURAT[june])], baseline, model)
    assert over.above_expected


def test_daily_temperatures_become_monthly_degree_days():
    days = ["2026-05-01", "2026-05-02", "2026-05-03"]
    out = monthly_from_daily(days, [30.0, 22.0, None])
    cdd, mean, observed = out[date(2026, 5, 1)]
    # Two observed days averaging 3 CDD a day, scaled to May's 31 days.
    assert observed == 2 and mean == 26.0 and cdd == pytest.approx(3.0 * 31)


def test_endpoint_adjusts_bills_for_weather_and_caches_climate(client, citizen, monkeypatch):
    calls = []

    async def fake_fetch(lat, lon, start, end):
        calls.append((start, end))
        return {m: (c, 30.0, climate.days_in_month(m)) for m, c in SURAT.items() if start <= m <= end}

    monkeypatch.setattr(climate, "_fetch", fake_fetch)
    monkeypatch.setattr(climate.get_settings(), "enable_external_apis", True)
    monkeypatch.setattr("app.routers.insights.today_ist", lambda: date(2026, 10, 15))
    from app.db import SessionLocal
    from app.models import EnergyReading

    # Onboarding answer (300 kWh) was given in May; later bills follow the weather plus a 10% cut.
    with SessionLocal() as db:
        db.query(EnergyReading).delete()
        db.add(EnergyReading(user_id=1, month=date(2026, 5, 1), kwh=300, source="onboarding"))
        for m in (date(2026, 6, 1), date(2026, 7, 1), date(2026, 8, 1), date(2026, 9, 1)):
            db.add(EnergyReading(user_id=1, month=m, kwh=round((90 + 0.8 * SURAT[m]) * 0.9, 1), source="manual"))
        db.commit()

    data = client.get("/api/insights/weather", headers=citizen).json()
    assert data["available"] and data["baseline_month"] == "2026-05" and data["model"]["source"] == "household"
    assert [m["month"] for m in data["months"]] == ["2026-06", "2026-07", "2026-08", "2026-09"]
    assert all(m["saving_pct"] > 0 for m in data["months"])  # real savings despite cooler months

    client.get("/api/insights/weather", headers=citizen)
    assert len(calls) == 1  # completed months come from the cache the second time


def test_endpoint_without_weather_data_says_why(client, citizen):
    data = client.get("/api/insights/weather", headers=citizen).json()
    assert data["available"] is False and data["reason"]


def test_endpoint_needs_onboarding(client):
    assert client.get("/api/insights/weather", headers=register(client)).status_code == 409

