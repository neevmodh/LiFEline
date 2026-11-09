"""Mid-month forecast: straight-line projection priced with the DISCOM's own slabs."""

from app.services import factors
from app.services.footprint import electricity_bill_rs
from app.services.forecast import forecast
from conftest import HOUSEHOLD, register


def test_projection_is_used_so_far_scaled_to_the_month_and_priced_by_slabs():
    f = forecast(100, 10, 2026, 11, "dgvcl", "urban")  # November: 30 days
    assert f.daily_kwh == 10 and f.projected_kwh == 300
    assert f.projected_bill_rs == electricity_bill_rs(300, "dgvcl", "urban")


def test_warns_when_the_projection_crosses_a_slab_but_there_is_still_room():
    tariff = factors.TARIFFS[("dgvcl", "urban")]
    edge = next(u for u, _ in tariff.slabs if u != float("inf"))
    used = edge * 0.6
    f = forecast(used, 15, 2026, 11, "dgvcl", "urban")  # 15 of 30 days used -> projects 1.2x the edge
    assert f.projected_kwh > edge
    assert f.next_slab_kwh == edge and f.kwh_to_next_slab == round(edge - used, 1)
    assert f.daily_budget_kwh == round((edge - used) / 15, 2)
    assert f.bill_if_budget_rs < f.projected_bill_rs


def test_no_warning_when_far_from_an_edge_or_already_over():
    tariff = factors.TARIFFS[("dgvcl", "urban")]
    edge = next(u for u, _ in tariff.slabs if u != float("inf"))
    assert forecast(edge * 0.1, 15, 2026, 11, "dgvcl", "urban").next_slab_kwh is None
    last = max(u for u, _ in tariff.slabs if u != float("inf"))
    assert forecast(last * 1.2, 15, 2026, 11, "dgvcl", "urban").next_slab_kwh is None  # every edge already passed


def test_endpoint_needs_a_household_and_returns_the_note(client):
    h = register(client)
    assert client.post("/api/forecast", json={"used_kwh": 100}, headers=h).status_code == 409
    client.put("/api/household", json=HOUSEHOLD, headers=h)
    r = client.post("/api/forecast", json={"used_kwh": 100, "day": 10}, headers=h)
    assert r.status_code == 200 and r.json()["daily_kwh"] == 10 and "Straight-line" in r.json()["note"]
    assert client.post("/api/forecast", json={"used_kwh": -1}, headers=h).status_code == 422
