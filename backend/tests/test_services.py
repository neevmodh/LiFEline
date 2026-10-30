from datetime import date, datetime

import pytest

from app.models import ActionStatus
from app.services import factors, solar
from app.services.footprint import FootprintInput, electricity_bill_rs, monthly_footprint
from app.services.gamification import daily_challenge_code, level_for, points_for
from app.services.nudges import NudgeContext, generate_nudges


def test_footprint_breakdown_adds_up():
    fp = monthly_footprint(FootprintInput(300, 4, 1, "car", 10))
    assert fp.electricity_kg == pytest.approx(300 * factors.GRID_KG_CO2_PER_KWH, abs=0.1)
    assert fp.cooking_kg == pytest.approx(factors.LPG_KG_CO2_PER_CYLINDER, abs=0.1)
    assert fp.commute_kg == pytest.approx(10 * 22 * 0.17, abs=0.1)
    assert fp.total_kg == pytest.approx(fp.electricity_kg + fp.cooking_kg + fp.commute_kg, abs=0.2)
    assert fp.per_capita_kg == pytest.approx(fp.total_kg / 4, abs=0.1)


def test_footprint_rejects_unknown_commute_mode():
    with pytest.raises(ValueError):
        monthly_footprint(FootprintInput(100, 1, 0, "rocket", 5))


def test_bill_uses_slabs():
    # 50 * 3.05 + 50 * 3.50 + 20 * 4.15 energy charges, plus FPPPA on all 120 units
    assert electricity_bill_rs(120) == pytest.approx(152.5 + 175 + 83 + 120 * factors.FPPPA_PER_KWH)
    assert electricity_bill_rs(0) == 0


def _ctx(**overrides):
    base = dict(
        now=datetime(2026, 5, 10, 19, 0),
        ac_count=1,
        has_geyser=True,
        has_washing_machine=True,
        has_ev=False,
        has_solar=False,
        commute_mode="two_wheeler",
        commute_km_per_day=10,
        baseline_kwh=300,
    )
    return NudgeContext(**{**base, **overrides})


def test_peak_hour_nudge_is_top_priority():
    nudges = generate_nudges(_ctx())
    assert nudges[0].code == "peak_defer"
    assert "geyser" in nudges[0].body


def test_no_peak_nudge_without_heavy_appliances():
    nudges = generate_nudges(_ctx(has_geyser=False, has_washing_machine=False))
    assert "peak_defer" not in {n.code for n in nudges}


def test_pre_cool_before_peak_and_solar_window_midday():
    assert "pre_cool" in {n.code for n in generate_nudges(_ctx(now=datetime(2026, 5, 10, 16, 30)))}
    assert "solar_window" in {n.code for n in generate_nudges(_ctx(now=datetime(2026, 5, 10, 11, 0)))}


def test_baseline_progress_nudges():
    above = generate_nudges(_ctx(now=datetime(2026, 5, 10, 23, 0), current_month_kwh=360))
    assert above[0].code == "above_baseline"
    below = generate_nudges(_ctx(now=datetime(2026, 5, 10, 23, 0), current_month_kwh=240))
    assert "below_baseline" in {n.code for n in below}


def test_ac_nudge_skipped_when_cool():
    nudges = generate_nudges(_ctx(now=datetime(2026, 1, 10, 23, 0), temperature_c=18))
    assert "ac_setpoint" not in {n.code for n in nudges}


def test_short_car_commute_nudge():
    nudges = generate_nudges(_ctx(now=datetime(2026, 5, 10, 23, 0), commute_mode="car", commute_km_per_day=6))
    assert "short_commute" in {n.code for n in nudges}


def test_solar_sizing_limited_by_roof():
    est = solar.estimate(roof_area_sqm=25, monthly_kwh=600, specific_yield=1500)
    assert est.recommended_kwp == 2.5
    assert est.limited_by == "roof"
    assert est.subsidy_rs == 30_000 * 2 + 18_000 * 0.5
    assert est.net_cost_rs == est.gross_cost_rs - est.subsidy_rs
    assert est.yield_source == "pvgis"


def test_solar_sizing_limited_by_consumption_and_default_yield():
    est = solar.estimate(roof_area_sqm=200, monthly_kwh=200)
    # 2400 kWh/yr / 1550 kWh/kWp = 1.55 kWp -> rounded down to 1.5
    assert est.recommended_kwp == 1.5
    assert est.limited_by == "consumption"
    assert est.yield_source == "default"
    assert est.payback_years and 0 < est.payback_years < 10


def test_subsidy_cap():
    assert factors.pm_surya_ghar_subsidy(10) == 78_000


def test_points_rules():
    assert points_for(10, ActionStatus.self_reported, False) == 4
    assert points_for(10, ActionStatus.verified, False) == 10
    assert points_for(10, ActionStatus.verified, True) == 20
    assert points_for(10, ActionStatus.pending, True) == 0
    assert points_for(10, ActionStatus.rejected, False) == 0


def test_daily_challenge_is_stable_and_rotates():
    codes = ["a", "b", "c", "d", "e"]
    day = date(2026, 11, 1)
    assert daily_challenge_code(day, codes) == daily_challenge_code(day, list(reversed(codes)))
    picks = {daily_challenge_code(date(2026, 11, d), codes) for d in range(1, 29)}
    assert len(picks) > 1


def test_levels():
    assert level_for(0)[:2] == (1, "Seedling")
    assert level_for(350)[:2] == (3, "Grove Keeper")
    assert level_for(350)[2] == 700


def test_night_nudges_are_never_empty():
    codes = {n.code for n in generate_nudges(_ctx(now=datetime(2026, 1, 10, 23, 30), ac_count=0, temperature_c=18))}
    assert {"off_peak_now", "standby_bedtime"} <= codes
