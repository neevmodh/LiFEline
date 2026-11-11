"""Issue #1: every action belongs to a Mission LiFE theme, and no CO2 figure is invented."""

from app.seed import ACTIONS
from app.services import factors
from app.services.impact import action_impact
from conftest import HOUSEHOLD, register


def test_catalogue_covers_all_seven_life_themes_with_about_twenty_actions():
    themes = {theme for _, _, theme, _, _ in ACTIONS}
    assert themes == set(factors.LIFE_THEMES)
    assert 18 <= len(ACTIONS) <= 25
    assert len({code for code, *_ in ACTIONS}) == len(ACTIONS)


def test_points_only_actions_claim_no_impact_and_say_so(client):
    h = register(client)
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    types = {t["code"]: t for t in client.get("/api/actions/types", headers=h).json()}
    assert set(types) == {code for code, *_ in ACTIONS}
    for code, t in types.items():
        assert t["theme"] in factors.LIFE_THEMES
        if code in factors.POINTS_ONLY_ACTIONS:
            assert t["impact_estimated"] is False and t["co2_saved_kg"] == 0 and t["kwh_saved"] == 0
        else:
            assert t["impact_estimated"] is True


def test_every_estimated_action_is_computed_from_sourced_factors():
    """Estimated actions are worked out from household data and the sourced factors in factors.py."""
    class H:
        ac_count, has_geyser, has_washing_machine, has_ev = 1, True, True, False
        commute_mode, commute_km_per_day, lpg_cylinders_per_month = "car", 10, 1

    for code, *_ in ACTIONS:
        impact = action_impact(code, H())
        if code in factors.POINTS_ONLY_ACTIONS:
            assert impact.estimated is False
        else:
            assert impact.estimated is True and impact.co2_kg >= 0


def test_carpool_halves_the_drivers_share_of_one_trip():
    class Car:
        ac_count, has_geyser, has_washing_machine, has_ev = 0, False, False, False
        commute_mode, commute_km_per_day, lpg_cylinders_per_month = "car", 20, 1

    impact = action_impact("carpool", Car())
    assert impact.co2_kg == round(10 * factors.COMMUTE_KG_CO2_PER_KM["car"] * 0.5, 2)

    class Bus(Car):
        commute_mode = "bus"

    assert action_impact("carpool", Bus()).applicable is False


def test_carpool_is_refused_for_households_that_do_not_drive(client):
    h = register(client)
    client.put("/api/household", json={**HOUSEHOLD, "commute_mode": "bus"}, headers=h)
    assert client.post("/api/actions", data={"action_code": "carpool"}, headers=h).status_code == 422
    assert client.post("/api/actions", data={"action_code": "millet_meal"}, headers=h).status_code == 201
