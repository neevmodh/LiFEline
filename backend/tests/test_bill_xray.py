"""Bill X-ray: the bill split exactly as the DISCOM charges it, and the numbers for "what if"."""

from types import SimpleNamespace

import pytest

from app.services import factors
from app.services.bill_xray import likely_uses, simulator_inputs, xray
from app.services.footprint import electricity_bill_rs


def home(**over):
    base = {"monthly_kwh": 300, "discom": "ugvcl", "area": "urban", "ac_count": 1, "has_geyser": True, "has_washing_machine": True,
                "has_ev": False, "has_solar": False, "roof_area_sqm": None, "commute_mode": "bus", "commute_km_per_day": 0,
                "lpg_cylinders_per_month": 1}
    base.update(over)
    return SimpleNamespace(**base)


@pytest.mark.parametrize("kwh", [1, 49, 50, 51, 100, 249, 250, 251, 300, 1200])
@pytest.mark.parametrize("discom,area", [("ugvcl", "urban"), ("dgvcl", "rural"), ("torrent", "urban")])
def test_the_parts_add_up_to_the_bill(kwh, discom, area):
    x = xray(home(discom=discom, area=area), kwh, 4)
    assert round(x.energy_rs + x.fixed_rs + x.fppas_rs + x.duty_rs, 2) == round(x.total_rs, 2)
    assert x.duty_rs >= 0
    assert x.total_rs == electricity_bill_rs(kwh, discom, area)
    assert round(sum(s.units for s in x.slabs), 1) == kwh
    assert x.slabs[-1].upto is None


def test_units_fill_the_slabs_in_order():
    x = xray(home(), 120, 4)  # state urban: 50 at 3.05, 50 at 3.50, 20 at 4.15
    assert [s.units for s in x.slabs] == [50, 50, 20, 0]
    assert x.top_rate == 4.15


def test_the_likely_split_always_sums_to_the_units_used():
    for kwh in (30, 150, 300, 900):
        uses = likely_uses(home(ac_count=2, has_ev=True), kwh, 5)
        assert round(sum(u.kwh for u in uses), 0) == kwh
        assert uses == sorted(uses, key=lambda u: u.kwh, reverse=True)


def test_no_ac_or_geyser_means_none_in_the_split():
    keys = {u.key for u in likely_uses(home(ac_count=0, has_geyser=False, has_washing_machine=False), 150, 3)}
    assert {"ac", "geyser", "washing", "ev"}.isdisjoint(keys)
    assert "fridge" in keys and "other" in keys


def test_a_small_bill_is_scaled_down_rather_than_overflowing():
    uses = likely_uses(home(ac_count=3), 40, 6)
    assert all(u.kwh >= 0 for u in uses)
    assert "other" not in {u.key for u in uses}


def test_zero_units_has_no_split():
    assert likely_uses(home(), 0, 4) == []


def test_levers_follow_the_household():
    none = simulator_inputs(home(ac_count=0, has_geyser=False), 1550)
    assert none["ac_kwh_per_degree"] == 0 and none["geyser_kwh"] == 0
    two = simulator_inputs(home(ac_count=2), 1550)
    assert two["ac_kwh_per_degree"] == round(2 * factors.AC_KWH_PER_DAY * 30 * 0.6 * factors.AC_SAVING_PER_DEGREE, 2)
    assert two["solar_kwh_per_kw"] == round(1550 / 12, 1)


def test_endpoint_needs_onboarding(client):
    from tests.conftest import register

    assert client.get("/api/bill/xray", headers=register(client)).status_code == 409


def test_endpoint_uses_the_household_or_a_scanned_month(client, citizen):
    usual = client.get("/api/bill/xray", headers=citizen).json()
    assert usual["kwh"] > 0 and usual["tariff"]["slabs"][-1][0] is None
    assert set(usual["levers"]) == {"ac_kwh_per_degree", "geyser_kwh", "standby_kwh", "led_kwh_each", "solar_kwh_per_kw"}
    scanned = client.get("/api/bill/xray?kwh=420", headers=citizen).json()
    assert scanned["kwh"] == 420 and scanned["total_rs"] > usual["total_rs"]
    for bad in ("0", "-5", "20001", "abc"):
        assert client.get(f"/api/bill/xray?kwh={bad}", headers=citizen).status_code == 422


def test_endpoint_needs_sign_in(client):
    assert client.get("/api/bill/xray").status_code == 401
