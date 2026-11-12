"""Solar beyond the calculator: shade, months, the bill with solar, today's output, and survey requests."""

from datetime import date, datetime

import pytest

from app.db import SessionLocal
from app.models import District, Role, User
from app.security import create_access_token, hash_password
from app.services import factors, solar
from app.services.footprint import electricity_bill_rs
from app.routers.solar_hub import sky_for


def test_shade_shrinks_the_usable_roof():
    sunny = solar.estimate(30, 600, 1500, shade="none")
    shaded = solar.estimate(30, 600, 1500, shade="heavy")
    assert sunny.usable_roof_sqm == 30 and shaded.usable_roof_sqm == 12
    assert shaded.recommended_kwp < sunny.recommended_kwp
    assert solar.estimate(30, 600, 1500, shade="nonsense").shade == "none"


def test_twelve_months_that_add_up_to_the_year():
    est = solar.estimate(40, 300, 1500)
    assert [m.month for m in est.months] == list(range(1, 13))
    assert sum(m.generation_kwh for m in est.months) == pytest.approx(est.annual_generation_kwh, abs=6)
    # The year's saving is the months' savings added up (bills are slabbed, so not 12 x one month).
    assert est.annual_savings_rs == pytest.approx(sum(m.bill_before_rs - m.bill_after_rs for m in est.months), abs=60)


def test_pvgis_months_shape_the_year_and_the_default_follows_gujarat():
    flat = solar.monthly_shares([100.0] * 12)
    assert all(s == pytest.approx(1 / 12) for s in flat)
    default = solar.monthly_shares(None)
    assert sum(default) == pytest.approx(1)
    assert default[3] > default[6]  # April's sun beats the July monsoon
    assert solar.monthly_shares([0.0] * 12) == default  # nonsense from PVGIS falls back
    assert solar.monthly_shares([1.0] * 5) == default


def test_bill_with_solar_never_goes_below_zero_and_never_rises():
    est = solar.estimate(100, 150, 1600)  # a big roof, small use: exports in sunny months
    for m in est.months:
        assert 0 <= m.bill_after_rs <= m.bill_before_rs
        assert m.bill_before_rs == round(electricity_bill_rs(150))
    assert any(m.exported_kwh > 0 for m in est.months)


def test_hourly_output_from_radiation():
    hours = solar.hourly_kwh_per_kwp({6: 0, 12: 900, 13: -5})
    assert hours == {6: 0.0, 12: round(900 / 1000 * solar.PERFORMANCE_RATIO, 3), 13: 0.0}
    assert sky_for(5.2) == "sunny" and sky_for(3.0) == "partly_cloudy" and sky_for(1.0) == "cloudy"


def test_estimate_endpoint_returns_months_and_bills(client):
    r = client.post("/api/solar/estimate", json={"roof_area_sqm": 30, "monthly_kwh": 300, "shade": "partial"})
    body = r.json()
    assert r.status_code == 200 and len(body["months"]) == 12 and body["shade"] == "partial"
    assert body["usable_roof_sqm"] == 21 and body["bill_after_rs"] < body["bill_before_rs"]
    assert client.post("/api/solar/estimate", json={"roof_area_sqm": 30, "monthly_kwh": 300, "shade": "x"}).status_code == 422


def test_today_needs_a_real_district_and_says_when_the_forecast_is_off(client):
    assert client.get("/api/solar/today?district_id=9999").status_code == 404
    body = client.get("/api/solar/today?district_id=1").json()
    assert body["district"] and body["sky"] == "unknown" and body["kwh_per_kwp"] == 0  # external data is off in tests


LEAD = {"kwp": 3, "roof_area_sqm": 35, "monthly_kwh": 320, "note": "Terrace, 2nd floor", "consent": True}


def staff(role: Role, district_id: int | None = None, email: str = "staff@example.com") -> dict:
    with SessionLocal() as db:
        u = User(email=email, name="Staff Person", role=role, district_id=district_id, password_hash=hash_password("x" * 8))
        db.add(u)
        db.commit()
        return {"Authorization": f"Bearer {create_access_token(u.id)}"}


def test_a_household_asks_once_and_sees_its_status(client, citizen):
    assert client.get("/api/solar/leads/mine", headers=citizen).json() is None
    assert client.post("/api/solar/leads", json={**LEAD, "consent": False}, headers=citizen).status_code == 422
    r = client.post("/api/solar/leads", json=LEAD, headers=citizen)
    assert r.status_code == 201 and r.json()["status"] == "new"
    assert client.post("/api/solar/leads", json=LEAD, headers=citizen).status_code == 409
    assert client.get("/api/solar/leads/mine", headers=citizen).json()["kwp"] == 3
    assert client.post("/api/solar/leads", json=LEAD).status_code == 401


def test_geda_moves_a_request_along_and_officers_stay_in_their_district(client, citizen):
    lead_id = client.post("/api/solar/leads", json=LEAD, headers=citizen).json()["id"]  # citizen is in district 1
    admin = staff(Role.admin, email="a@example.com")
    queue = client.get("/api/admin/solar-leads", headers=admin).json()
    assert queue["counts"]["new"] == 1 and queue["kwp_requested"] == 3
    assert queue["leads"][0]["email"] and queue["leads"][0]["note"] == "Terrace, 2nd floor"

    r = client.patch(f"/api/admin/solar-leads/{lead_id}", json={"status": "contacted", "staff_note": "Called"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "contacted"
    assert client.get("/api/solar/leads/mine", headers=citizen).json()["status"] == "contacted"
    assert client.patch(f"/api/admin/solar-leads/{lead_id}", json={"status": "bogus"}, headers=admin).status_code == 422

    other = staff(Role.officer, district_id=2, email="o2@example.com")
    assert client.patch(f"/api/admin/solar-leads/{lead_id}", json={"status": "quoted"}, headers=other).status_code == 403
    assert client.get("/api/admin/solar-leads", headers=other).json()["leads"] == []
    own = staff(Role.officer, district_id=1, email="o1@example.com")
    assert client.patch(f"/api/admin/solar-leads/{lead_id}", json={"status": "installed"}, headers=own).status_code == 200

    auditor = staff(Role.auditor, email="au@example.com")
    seen = client.get("/api/admin/solar-leads", headers=auditor).json()["leads"][0]
    assert seen["email"] == "" and seen["phone"] is None  # auditors don't get contact details
    assert client.patch(f"/api/admin/solar-leads/{lead_id}", json={"status": "dropped"}, headers=auditor).status_code == 403
    assert client.get("/api/admin/solar-leads", headers=citizen).status_code == 403


def test_a_closed_request_allows_a_new_one_and_leaves_with_the_account(client, citizen):
    lead_id = client.post("/api/solar/leads", json=LEAD, headers=citizen).json()["id"]
    admin = staff(Role.admin, email="a2@example.com")
    client.patch(f"/api/admin/solar-leads/{lead_id}", json={"status": "dropped"}, headers=admin)
    assert client.post("/api/solar/leads", json=LEAD, headers=citizen).status_code == 201
    export = client.get("/api/account/export", headers=citizen).json()
    assert len(export["solar_survey_requests"]) == 2
    assert client.request("DELETE", "/api/account", json={"password": "secret123"}, headers=citizen).status_code == 204
    assert client.get("/api/admin/solar-leads", headers=admin).json()["leads"] == []
