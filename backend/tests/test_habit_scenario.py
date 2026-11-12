"""With vs without Mission LiFE: the console's projection is built from what real households saved."""

from app.routers.admin import spread
from tests.conftest import register

HOUSEHOLD = {"monthly_kwh": 300, "members": 4, "lpg_cylinders_per_month": 1, "commute_mode": "bus", "commute_km_per_day": 5,
             "home_type": "apartment", "ac_count": 1, "has_geyser": True, "has_washing_machine": True, "has_ev": False,
             "has_solar": False, "roof_area_sqm": 20, "discom": "ugvcl", "area": "urban"}


def test_spread_is_the_quartiles():
    assert spread([]) == (0.0, 0.0, 0.0)
    assert spread([5]) == (5, 5, 5)
    assert spread([1, 2, 3, 4, 5]) == (2, 3, 4)
    assert spread([4, 1, 3, 2]) == (1.75, 2.5, 3.25)  # order doesn't matter, interpolated


def test_counts_registered_and_active_and_spreads_their_savings(client, admin_headers):
    homes = []
    for i, district in enumerate((1, 1, 1, 2)):
        h = register(client, f"h{i}@example.com", district_id=district)
        client.put("/api/household", json=HOUSEHOLD, headers=h)
        homes.append(h)
    for _ in range(2):
        client.post("/api/actions", data={"action_code": "standby_off"}, headers=homes[0])
    client.post("/api/actions", data={"action_code": "standby_off"}, headers=homes[1])

    state = client.get("/api/admin/habit-scenario", headers=admin_headers).json()
    assert state["district"] == "Gujarat" and state["registered_households"] == 4 and state["active_households"] == 2
    assert 0 < state["kwh_saved"]["low"] <= state["kwh_saved"]["mid"] <= state["kwh_saved"]["high"]
    assert state["rs_saved"]["mid"] > 0 and state["avg_monthly_kwh"] == 300

    d2 = client.get("/api/admin/habit-scenario?district_id=2", headers=admin_headers).json()
    assert d2["registered_households"] == 1 and d2["active_households"] == 0 and d2["kwh_saved"]["mid"] == 0


def test_access(client, citizen, admin_headers):
    assert client.get("/api/admin/habit-scenario", headers=citizen).status_code == 403
    assert client.get("/api/admin/habit-scenario?district_id=999", headers=admin_headers).status_code == 404
