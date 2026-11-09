"""The personal savings plan: rupees come from the household's own bill and tariff."""

from types import SimpleNamespace

import pytest
from conftest import register

from app.services import factors
from app.services.footprint import electricity_bill_rs
from app.services.plan import build_plan, marginal_rate, slab_insight


def household(**kw):
    base = dict(monthly_kwh=266, discom="dgvcl", area="urban", ac_count=1, has_geyser=True, has_washing_machine=True,
                has_ev=False, has_solar=False, roof_area_sqm=40, commute_mode="car", commute_km_per_day=12,
                lpg_cylinders_per_month=1)
    return SimpleNamespace(**{**base, **kw})


def test_marginal_rate_is_slab_plus_fuel_charge_and_duty():
    t = factors.TARIFFS[("dgvcl", "urban")]
    assert marginal_rate(household()) == pytest.approx((5.20 + t.fppas_rs_per_kwh) * (1 + t.duty_share), abs=0.01)


def test_each_habit_is_priced_as_the_drop_in_this_households_bill():
    h = household()
    ac = next(i for i in build_plan(h).items if i.code == "ac_setpoint")
    expected = electricity_bill_rs(266, "dgvcl", "urban") - electricity_bill_rs(266 - ac.kwh_month, "dgvcl", "urban")
    assert ac.rs_month == pytest.approx(round(expected), abs=1) and ac.action_code == "ac_24"


def test_steps_follow_the_household_and_are_ranked_easy_first():
    none = build_plan(household(ac_count=0, has_geyser=False, has_washing_machine=False, commute_mode="bus",
                                roof_area_sqm=None))
    codes = [i.code for i in none.items]
    assert "ac_setpoint" not in codes and "geyser_timer" not in codes and "commute" not in codes
    assert "peak_shift" not in codes and "solar" not in codes
    full = build_plan(household())
    efforts = [i.effort for i in full.items]
    assert efforts == sorted(efforts, key=["easy", "medium", "investment"].index)
    assert full.items[-1].code == "solar" and full.total_rs_month == sum(i.rs_month for i in full.items if i.kind == "habit")


def test_habits_never_claim_more_than_a_third_of_a_small_bill():
    tiny = build_plan(household(monthly_kwh=60, ac_count=3))
    assert sum(i.kwh_month for i in tiny.items if i.kind == "habit") <= 0.35 * 60 + 0.5


def test_slab_insight_only_when_a_cheaper_slab_is_within_reach():
    near = slab_insight(household(monthly_kwh=266))  # 16 units above the 250 slab edge
    assert near and near.units_over == 16 and near.rate_now == 5.20 and near.rate_below == 4.15 and near.rs_if_cut > 0
    assert slab_insight(household(monthly_kwh=900)) is None  # far above any edge
    assert slab_insight(household(monthly_kwh=40)) is None  # already in the cheapest slab


def test_plan_endpoint_explains_each_step_and_tracks_todays_actions(client, citizen):
    data = client.get("/api/plan", headers=citizen).json()
    assert data["bill_rs"] > 0 and data["marginal_rs_per_kwh"] > 0 and data["items"]
    ac = next(i for i in data["items"] if i["code"] == "ac_setpoint")
    assert "24°C" in ac["title"] and "units a month" in ac["why"] and ac["logged_today"] is False
    client.post("/api/actions", data={"action_code": "ac_24"}, headers=citizen)
    after = client.get("/api/plan", headers=citizen).json()
    assert next(i for i in after["items"] if i["code"] == "ac_setpoint")["logged_today"] is True


def test_indian_digit_grouping():
    from app.routers.plan import inr

    assert [inr(n) for n in (0, 999, 1000, 40000, 100000, 1234567)] == ["0", "999", "1,000", "40,000", "1,00,000", "12,34,567"]


def test_plan_needs_onboarding(client):
    assert client.get("/api/plan", headers=register(client)).status_code == 409


