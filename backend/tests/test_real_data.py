"""Personalised impact, duplicate photos, wards, sources and admin setup."""

import asyncio
import io

import pytest
from conftest import HOUSEHOLD, photo, register
from PIL import Image

from app.schemas import normalise_ward
from app.services import factors
from app.services.impact import action_impact
from app.storage import LocalStorage, StorageError


class H:
    def __init__(self, **kw):
        base = dict(ac_count=2, has_geyser=True, has_washing_machine=True, has_ev=False,
                    commute_mode="car", commute_km_per_day=8, lpg_cylinders_per_month=1)
        base.update(kw)
        self.__dict__.update(base)


# --- impact ------------------------------------------------------------------

def test_ac_saving_scales_with_number_of_acs():
    one = action_impact("ac_24", H(ac_count=1))
    assert one.kwh == pytest.approx(9.6 * 0.06 * 2, abs=0.01)
    assert action_impact("ac_24", H(ac_count=3)).kwh == pytest.approx(one.kwh * 3, abs=0.02)
    assert one.co2_kg == pytest.approx(one.kwh * factors.GRID_KG_CO2_PER_KWH, abs=0.01)


def test_commute_savings_use_the_households_own_trip():
    car = action_impact("public_transport", H(commute_mode="car", commute_km_per_day=20))
    assert car.co2_kg == pytest.approx(10 * (0.17 - 0.03), abs=0.01)  # one 10 km trip
    walk = action_impact("cycle_walk", H(commute_mode="two_wheeler", commute_km_per_day=30))
    assert walk.co2_kg == pytest.approx(5 * 0.05, abs=0.01)  # capped at a 5 km short trip


@pytest.mark.parametrize(
    "code,household,reason",
    [
        ("ac_24", H(ac_count=0), "no AC"),
        ("geyser_off", H(has_geyser=False), "no geyser"),
        ("shift_heavy_load", H(has_geyser=False, has_washing_machine=False), "no washing machine"),
        ("public_transport", H(commute_mode="bus"), "without a private vehicle"),
        ("cycle_walk", H(commute_mode="cycle_walk"), "already walk"),
        ("pressure_cooker", H(lpg_cylinders_per_month=0), "LPG"),
    ],
)
def test_actions_that_dont_apply_say_why(code, household, reason):
    impact = action_impact(code, household)
    assert not impact.applicable and reason in impact.reason


def test_peak_shift_uses_operating_margin_and_saves_no_kwh():
    impact = action_impact("shift_heavy_load", H(has_geyser=True, has_washing_machine=True))
    margin = factors.GRID_OPERATING_MARGIN_KG_CO2_PER_KWH - factors.GRID_KG_CO2_PER_KWH
    assert impact.kwh == 0 and impact.co2_kg == pytest.approx(1.0 * margin, abs=0.01)


def test_types_are_personalised_and_inapplicable_actions_are_refused(client):
    headers = register(client)
    client.put("/api/household", json={**HOUSEHOLD, "ac_count": 0}, headers=headers)
    types = {t["code"]: t for t in client.get("/api/actions/types", headers=headers).json()}
    assert types["ac_24"]["applicable"] is False and "no AC" in types["ac_24"]["not_applicable_reason"]
    assert types["public_transport"]["co2_saved_kg"] == pytest.approx(4 * 0.14, abs=0.01)
    resp = client.post("/api/actions", data={"action_code": "ac_24"}, headers=headers)
    assert resp.status_code == 422 and "no AC" in resp.json()["detail"]

    logged = client.post("/api/actions", data={"action_code": "public_transport"}, headers=headers).json()
    assert logged["co2_saved_kg"] == pytest.approx(0.56, abs=0.01)


def test_logging_needs_onboarding(client):
    headers = register(client)
    assert client.post("/api/actions", data={"action_code": "cloth_bag"}, headers=headers).status_code == 409


# --- proof photos ----------------------------------------------------------------

def _post_proof(client, headers, data, name="p.jpg", mime="image/jpeg", code="plant_tree"):
    return client.post("/api/actions", data={"action_code": code},
                       files={"proof": (name, data, mime)}, headers=headers)


def test_reused_photo_is_rejected_even_resized_and_recompressed(client, citizen):
    original = photo(10, "JPEG")
    assert _post_proof(client, citizen, original).status_code == 201

    img = Image.open(io.BytesIO(original))
    buf = io.BytesIO()
    img.resize((img.width // 2, img.height // 2)).save(buf, "JPEG", quality=60)
    other = register(client, email="ravi@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=other)
    resp = _post_proof(client, other, buf.getvalue())
    assert resp.status_code == 409 and "already been submitted" in resp.json()["detail"]

    # A different photo is fine.
    assert _post_proof(client, other, photo(11, "JPEG")).status_code == 201


def test_rejected_photo_can_be_used_again(client, citizen, admin_headers):
    pic = photo(12)
    log = _post_proof(client, citizen, pic, "p.png", "image/png").json()
    client.post(f"/api/admin/reviews/{log['id']}", json={"approve": False}, headers=admin_headers)
    other = register(client, email="ravi@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=other)
    assert _post_proof(client, other, pic, "p.png", "image/png").status_code == 201


def test_fake_and_blank_images_are_refused(client, citizen):
    assert _post_proof(client, citizen, b"\x89PNG\r\n\x1a\n" + b"0" * 100, "x.png", "image/png").status_code == 415
    blank = io.BytesIO()
    Image.new("RGB", (200, 200), (250, 250, 250)).save(blank, "PNG")
    assert _post_proof(client, citizen, blank.getvalue(), "b.png", "image/png").status_code == 422


def test_rejection_zeroes_the_stored_impact(client, citizen, admin_headers):
    log = _post_proof(client, citizen, photo(13)).json()
    client.post(f"/api/admin/reviews/{log['id']}", json={"approve": False}, headers=admin_headers)
    mine = client.get("/api/actions/mine", headers=citizen).json()[0]
    assert mine["status"] == "rejected" and mine["co2_saved_kg"] == 0 and mine["kwh_saved"] == 0


def test_local_storage_refuses_paths_outside_its_folder(tmp_path):
    store = LocalStorage(str(tmp_path / "proofs"))
    name = asyncio.run(store.save(b"data", "image/png", ".png"))
    assert asyncio.run(store.load(name)) == b"data"
    with pytest.raises(StorageError):
        asyncio.run(store.load("../secret.txt"))


# --- wards -------------------------------------------------------------------

@pytest.mark.parametrize("raw", ["ward-3", "3", "Ward 03", "WARD 3", " ward  no. 3 ", "Ward #3"])
def test_ward_spellings_collapse_to_one(raw):
    assert normalise_ward(raw) == "Ward 3"


def test_named_areas_are_tidied_not_renamed():
    assert normalise_ward("  adajan ") == "Adajan"
    assert normalise_ward("SG Highway") == "SG Highway"
    assert normalise_ward("   ") is None


def test_ward_is_normalised_on_sign_up(client):
    resp = client.post("/api/auth/register", json={
        "email": "w@example.com", "password": "secret123", "name": "W", "district_id": 1, "ward": "ward-04"})
    assert resp.json()["user"]["ward"] == "Ward 4"


# --- sources, DISCOMs, admin -------------------------------------------------------------------

def test_config_lists_every_source_and_discom(client):
    cfg = client.get("/api/config").json()
    assert cfg["peak_hours"] == list(factors.PEAK_HOURS)
    assert {d["code"] for d in cfg["discoms"]} == set(factors.DISCOMS)
    assert all(s["source"] for s in cfg["sources"]) and len(cfg["sources"]) == len(factors.SOURCES)


def test_districts_suggest_their_discom(client):
    by_name = {d["name"]: d["suggested_discom"] for d in client.get("/api/districts").json()}
    assert len(by_name) == 33
    assert by_name["Rajkot"] == "pgvcl" and by_name["Vadodara"] == "mgvcl" and by_name["Valsad"] == "dgvcl"


def test_household_bill_uses_its_discom(client, citizen):
    rural = client.put("/api/household", json={**HOUSEHOLD, "discom": "pgvcl", "area": "rural"}, headers=citizen)
    urban = client.put("/api/household", json={**HOUSEHOLD, "discom": "pgvcl", "area": "urban"}, headers=citizen)
    assert rural.json()["footprint"]["monthly_bill_rs"] < urban.json()["footprint"]["monthly_bill_rs"]
    assert client.get("/api/household", headers=citizen).json()["household"]["area"] == "urban"


def test_create_admin_makes_a_working_admin(client):
    from app.create_admin import create_admin

    create_admin("Officer@GEDA.example", "District Officer", "long-enough-pass")
    resp = client.post("/api/auth/login", json={"email": "officer@geda.example", "password": "long-enough-pass"})
    assert resp.status_code == 200 and resp.json()["user"]["role"] == "admin"
    with pytest.raises(ValueError):
        create_admin("x@example.com", "X", "short")


def test_catalogue_has_no_demo_users(client):
    from app.db import SessionLocal
    from app.models import User

    with SessionLocal() as db:
        assert db.query(User).count() == 0


# --- AI pre-screening ----------------------------------------------------------------

def test_proof_is_ai_screened_and_shown_to_reviewers(client, citizen, admin_headers, monkeypatch):
    from app.routers import actions
    from app.services.proof_screen import Screening

    async def fake_screen(image, media_type, title, description):
        assert title == "Planted a tree" and media_type == "image/png"
        return Screening("likely", 0.9, "A sapling being planted in soil.")

    monkeypatch.setattr(actions, "screen_proof", fake_screen)
    _post_proof(client, citizen, photo(20), "t.png", "image/png")
    item = client.get("/api/admin/reviews", headers=admin_headers).json()[0]
    assert item["ai_verdict"] == "likely" and item["ai_confidence"] == 0.9 and "sapling" in item["ai_reason"]


def test_screening_without_ai_provider_leaves_proof_unscreened(client, citizen, admin_headers):
    _post_proof(client, citizen, photo(21), "t.png", "image/png")
    item = client.get("/api/admin/reviews", headers=admin_headers).json()[0]
    assert item["ai_verdict"] is None


def test_screening_parses_and_clamps_model_output(monkeypatch):
    from app.config import get_settings
    from app.services import proof_screen

    monkeypatch.setattr(get_settings(), "groq_api_key", "k")

    async def fake_groq(image, media_type, prompt, schema, name):
        assert "Planted a tree" in prompt and name == "proof"
        return '{"verdict": "unlikely", "confidence": 1.7, "reason": "A screenshot of a website."}'

    monkeypatch.setattr(proof_screen, "groq_json", fake_groq)
    result = asyncio.run(proof_screen.screen_proof(b"img", "image/png", "Planted a tree", "desc"))
    assert result.verdict == "unlikely" and result.confidence == 1.0
