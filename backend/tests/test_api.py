from app.services import factors
from conftest import HOUSEHOLD, photo, register


def test_register_login_and_me(client):
    headers = register(client)
    assert client.get("/api/auth/me", headers=headers).json()["onboarded"] is False

    resp = client.post("/api/auth/login", json={"email": "ASHA@example.com", "password": "secret123"})
    assert resp.status_code == 200
    assert client.post("/api/auth/login", json={"email": "asha@example.com", "password": "wrong-pass"}).status_code == 401


def test_duplicate_email_rejected(client):
    register(client)
    resp = client.post(
        "/api/auth/register",
        json={"email": "asha@example.com", "password": "secret123", "name": "A", "district_id": 1},
    )
    assert resp.status_code == 409


def test_protected_routes_need_token(client):
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/dashboard", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_dashboard_requires_onboarding(client):
    headers = register(client)
    assert client.get("/api/dashboard", headers=headers).status_code == 409


def test_onboarding_sets_baseline_and_first_reading(client, citizen):
    data = client.get("/api/household", headers=citizen).json()
    assert data["household"]["baseline_kg_co2_month"] == data["footprint"]["total_kg"]
    readings = client.get("/api/readings", headers=citizen).json()
    assert len(readings) == 1 and readings[0]["kwh"] == HOUSEHOLD["monthly_kwh"]


def test_reading_upsert_and_future_month_rejected(client, citizen):
    resp = client.post("/api/readings", json={"month": "2026-01", "kwh": 270}, headers=citizen)
    assert resp.status_code == 200
    assert resp.json()["change_vs_baseline_pct"] == -10.0
    assert resp.json()["kg_co2"] == round(270 * factors.GRID_KG_CO2_PER_KWH, 1)

    client.post("/api/readings", json={"month": "2026-01", "kwh": 250}, headers=citizen)
    months = [r for r in client.get("/api/readings", headers=citizen).json() if r["month"] == "2026-01"]
    assert len(months) == 1 and months[0]["kwh"] == 250

    assert client.post("/api/readings", json={"month": "2099-01", "kwh": 1}, headers=citizen).status_code == 422


def test_log_action_self_reported_and_daily_cap(client, citizen):
    resp = client.post("/api/actions", data={"action_code": "geyser_off"}, headers=citizen)
    assert resp.status_code == 201
    log = resp.json()
    assert log["status"] == "self_reported"
    expected = 8 if log["is_daily_challenge"] else 4  # 40% of 10, doubled for the daily challenge
    assert log["points_awarded"] == expected

    again = client.post("/api/actions", data={"action_code": "geyser_off"}, headers=citizen)
    assert again.status_code == 429


def test_daily_challenge_bonus_applies_once(client, citizen):
    challenge = client.get("/api/actions/today", headers=citizen).json()
    code = challenge["action"]["code"]
    first = client.post("/api/actions", data={"action_code": code}, headers=citizen).json()
    assert first["is_daily_challenge"] is True
    assert client.get("/api/actions/today", headers=citizen).json()["completed"] is True


def test_proof_flow_pending_then_verified(client, citizen, admin_headers):
    png = photo(1)
    resp = client.post(
        "/api/actions",
        data={"action_code": "plant_tree", "note": "Neem sapling"},
        files={"proof": ("tree.png", png, "image/png")},
        headers=citizen,
    )
    log = resp.json()
    assert log["status"] == "pending" and log["points_awarded"] == 0 and log["has_proof"]

    queue = client.get("/api/admin/reviews", headers=admin_headers).json()
    assert [item["id"] for item in queue] == [log["id"]]
    assert client.get(f"/api/admin/reviews/{log['id']}/proof", headers=admin_headers).content == png

    assert client.post(f"/api/admin/reviews/{log['id']}", json={"approve": True}, headers=admin_headers).status_code == 204
    mine = client.get("/api/actions/mine", headers=citizen).json()[0]
    assert mine["status"] == "verified"
    assert mine["points_awarded"] == (100 if mine["is_daily_challenge"] else 50)


def test_proof_must_be_image(client, citizen):
    resp = client.post(
        "/api/actions",
        data={"action_code": "plant_tree"},
        files={"proof": ("x.pdf", b"%PDF", "application/pdf")},
        headers=citizen,
    )
    assert resp.status_code == 415


def test_admin_routes_forbidden_for_citizens(client, citizen):
    assert client.get("/api/admin/overview", headers=citizen).status_code == 403


def test_dashboard_and_leaderboards(client, citizen):
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)
    other = register(client, email="ravi@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=other)

    dash = client.get("/api/dashboard", headers=citizen).json()
    assert dash["streak_days"] == 1
    assert dash["district_rank"] == 1
    assert dash["district_participants"] == 2
    assert dash["co2_saved_kg"] > 0

    board = client.get("/api/leaderboard/users?period=week", headers=other).json()
    assert board[0]["name"] == "Asha" and any(r["is_me"] for r in board)

    districts = client.get("/api/leaderboard/districts").json()
    assert districts[0]["participants"] == 2 and districts[0]["co2_saved_kg"] > 0
    baseline = client.get("/api/household", headers=citizen).json()["household"]["baseline_kg_co2_month"]
    assert districts[0]["monthly_goal_kg"] == round(2 * baseline * 0.10)


def test_nudges_endpoint(client, citizen):
    data = client.get("/api/nudges", headers=citizen).json()
    assert data["temperature_c"] is None  # external APIs disabled in tests
    assert all({"code", "title", "body"} <= n.keys() for n in data["nudges"])


def test_solar_estimate_falls_back_offline(client):
    resp = client.post("/api/solar/estimate", json={"roof_area_sqm": 30, "monthly_kwh": 350, "district_id": 1})
    assert resp.status_code == 200
    body = resp.json()
    assert body["yield_source"] == "default" and body["recommended_kwp"] == 2.5  # 4200 kWh/yr / 1550


def test_admin_overview(client, citizen, admin_headers):
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)
    data = client.get("/api/admin/overview", headers=admin_headers).json()
    assert data["citizens"] == 1 and data["onboarded"] == 1 and data["active_7d"] == 1
    assert data["actions_total"] == 1
    assert sum(w["actions"] for w in data["weekly"]) == 1
    assert next(d for d in data["districts"] if d["district_id"] == 1)["actions_30d"] == 1


def test_timestamps_are_serialised_as_utc(client, citizen):
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)
    created = client.get("/api/actions/mine", headers=citizen).json()[0]["created_at"]
    assert created.endswith("Z") or created.endswith("+00:00")


def test_ward_leaderboard_and_profile_update(client, citizen):
    other = register(client, email="ravi@example.com")  # same district and ward as Asha
    third = register(client, email="mina@example.com")
    client.patch("/api/auth/me", json={"ward": "Ward 9"}, headers=third)

    ward_names = {r["user_id"] for r in client.get("/api/leaderboard/users?scope=ward", headers=other).json()}
    district_names = {r["user_id"] for r in client.get("/api/leaderboard/users?scope=district", headers=other).json()}
    assert len(ward_names) == 2 and len(district_names) == 3

    resp = client.patch("/api/auth/me", json={"name": " Asha P ", "district_id": 2, "ward": None}, headers=citizen)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Asha P" and resp.json()["district_id"] == 2 and resp.json()["ward"] is None
    assert client.get("/api/leaderboard/users?scope=ward", headers=citizen).status_code == 409
    assert client.patch("/api/auth/me", json={"district_id": 999}, headers=citizen).status_code == 422


def test_login_is_rate_limited(client):
    register(client)
    for _ in range(10):
        client.post("/api/auth/login", json={"email": "asha@example.com", "password": "wrong-pass"})
    resp = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "secret123"})
    assert resp.status_code == 429 and int(resp.headers["retry-after"]) > 0
    # A different account from the same IP is unaffected.
    register(client, email="ravi@example.com")
    assert client.post("/api/auth/login", json={"email": "ravi@example.com", "password": "secret123"}).status_code == 200


def test_bill_scan_falls_back_when_ai_not_configured(client, citizen):
    png = photo(2)
    resp = client.post("/api/bills/scan", files={"photo": ("bill.png", png, "image/png")}, headers=citizen)
    assert resp.status_code == 503
    bad = client.post("/api/bills/scan", files={"photo": ("bill.txt", b"hi", "text/plain")}, headers=citizen)
    assert bad.status_code == 415


def test_bill_scan_with_ai(client, citizen, monkeypatch):
    from app.routers import household
    from app.services.bill_scan import BillReading, ScanResult

    jpeg = photo(3, "JPEG")

    async def fake_scan(image, media_type):
        assert media_type == "image/jpeg" and image == jpeg
        reading = BillReading(units_kwh=540, billing_days=60, billing_period_end="2026-09", bill_amount_rs=4200,
                              distributor="DGVCL", confidence="high")
        return ScanResult(reading, "groq")

    monkeypatch.setattr(household, "scan_bill", fake_scan)
    resp = client.post("/api/bills/scan", files={"photo": ("bill.jpg", jpeg, "image/jpeg")}, headers=citizen)
    assert resp.status_code == 200
    assert resp.json()["monthly_kwh"] == 270.0  # bi-monthly bill normalised to 30 days
    assert resp.json()["provider"] == "groq"


def test_admin_district_detail(client, citizen, admin_headers):
    other = register(client, email="ravi@example.com")
    client.put("/api/household", json={**HOUSEHOLD, "has_solar": True}, headers=other)  # already has solar
    client.post("/api/actions", data={"action_code": "shift_heavy_load"}, headers=citizen)
    client.post("/api/actions", data={"action_code": "solar_survey"}, headers=citizen)
    client.post("/api/readings", json={"month": "2026-09", "kwh": 280}, headers=citizen)

    d = client.get("/api/admin/districts/1", headers=admin_headers).json()
    assert d["district"] == "Ahmedabad" and d["citizens"] == 2 and d["onboarded"] == 2
    assert d["active_7d"] == 1 and d["participation_pct"] == 50.0
    assert d["peak_shifts_30d"] == 1 and d["solar_survey_requests"] == 1
    assert d["top_wards"] == []  # two households in a ward is too few to show (privacy)
    assert {c["month"] for c in d["consumption"]} >= {"2026-09"}
    assert len(d["weekly"]) == 8 and sum(w["actions"] for w in d["weekly"]) == 2

    # 40 m² roof, 300 kWh/month -> 2.0 kWp (consumption-limited); Ravi already has solar.
    assert d["solar"]["suitable_households"] == 1 and d["solar"]["installed_households"] == 1
    assert d["solar"]["potential_kwp"] == 2.0 and d["solar"]["subsidy_pipeline_rs"] == 60000

    overview = client.get("/api/admin/overview", headers=admin_headers).json()
    ahmedabad = next(x for x in overview["districts"] if x["district_id"] == 1)
    assert ahmedabad["solar_potential_kwp"] == 2.0 and ahmedabad["participation_pct"] == 50.0
    assert len(overview["districts"]) == 33

    assert client.get("/api/admin/districts/999", headers=admin_headers).status_code == 404
    assert client.get("/api/admin/districts/1", headers=citizen).status_code == 403
    for i in range(3):  # three more in the same ward make five
        register(client, email=f"neighbour{i}@example.com")
    wards = client.get("/api/admin/districts/1", headers=admin_headers).json()["top_wards"]
    assert wards[0]["ward"] == "Ward 3" and wards[0]["citizens"] == 5


def test_overlong_password_is_a_validation_error_not_a_crash(client):
    # bcrypt rejects more than 72 bytes; this used to surface as a 500.
    for password in ("a" * 73, "é" * 40):  # 73 bytes, and 40 characters that encode to 80 bytes
        resp = client.post(
            "/api/auth/register",
            json={"email": "long@example.com", "password": password, "name": "L", "district_id": 1},
        )
        assert resp.status_code == 422
    register(client)
    resp = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "a" * 100})
    assert resp.status_code == 401


def test_many_signups_from_one_shared_ip(client):
    # Event and campus Wi-Fi put many real people behind one public address.
    for i in range(12):
        register(client, email=f"visitor{i}@example.com")


def test_admin_overview_separates_verified_co2(client, citizen, admin_headers):
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)  # self-reported
    png = photo(4)
    log = client.post(
        "/api/actions", data={"action_code": "plant_tree"}, files={"proof": ("t.png", png, "image/png")}, headers=citizen
    ).json()
    client.post(f"/api/admin/reviews/{log['id']}", json={"approve": True}, headers=admin_headers)

    # Savings are personalised: this household commutes 8 km a day by car.
    types = {t["code"]: t for t in client.get("/api/actions/types", headers=citizen).json()}
    data = client.get("/api/admin/overview", headers=admin_headers).json()
    assert data["co2_verified_total_kg"] == round(types["plant_tree"]["co2_saved_kg"], 1)
    assert data["co2_saved_total_kg"] == round(
        types["plant_tree"]["co2_saved_kg"] + types["cycle_walk"]["co2_saved_kg"], 1
    )


def test_health_reports_dependencies(client):
    data = client.get("/api/health").json()
    assert data["status"] == "ok" and data["checks"]["database"].startswith("ok")
    assert data["checks"]["photo_storage"] == "local"


def test_health_is_503_when_database_is_down(client, monkeypatch):
    from sqlalchemy.exc import OperationalError

    import app.main as main

    class Broken:
        def __enter__(self):
            raise OperationalError("SELECT 1", {}, Exception("down"))

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(main, "SessionLocal", lambda: Broken())
    resp = client.get("/api/health")
    assert resp.status_code == 503 and resp.json()["checks"]["database"] == "unreachable"


def test_activity_feed_is_live_and_private(client, citizen, admin_headers):
    client.patch("/api/auth/me", json={"name": "Asha Patel"}, headers=citizen)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)
    feed = client.get("/api/admin/activity", headers=admin_headers).json()
    kinds = [e["kind"] for e in feed]
    assert "joined" in kinds and "action" in kinds
    action = next(e for e in feed if e["kind"] == "action")
    assert action["first_name"] == "Asha" and action["action_title"] == "Walked or cycled" and action["co2_saved_kg"] > 0
    text = str(feed)
    assert "Patel" not in text and "@" not in text and "Ward" not in text  # first name and district only

    latest = max(e["at"] for e in feed)
    assert client.get(f"/api/admin/activity?since={latest}", headers=admin_headers).json() == []
    assert client.get("/api/admin/activity", headers=citizen).status_code == 403


def test_solar_scenario_matches_the_citizen_calculator(client, citizen, admin_headers):
    from app.services import solar

    # The citizen fixture: 40 m² roof, 300 kWh a month, default tariff.
    one = solar.estimate(40, 300)
    full = client.get("/api/admin/solar-scenario?adoption_pct=100&district_id=1", headers=admin_headers).json()
    assert full["suitable_homes"] == 1 and full["adopting_homes"] == 1
    assert full["capacity_mw"] == round(one.recommended_kwp / 1000, 3)
    assert full["subsidy_needed_rs"] == one.subsidy_rs
    assert full["per_1000_homes"]["capacity_mw"] == round(one.recommended_kwp, 2)

    half = client.get("/api/admin/solar-scenario?adoption_pct=50", headers=admin_headers).json()
    assert half["district"] == "Gujarat" and half["subsidy_needed_rs"] == round(one.subsidy_rs * 0.5)
    assert client.get("/api/admin/solar-scenario?adoption_pct=150", headers=admin_headers).status_code == 422
    assert client.get("/api/admin/solar-scenario", headers=citizen).status_code == 403


def test_district_report_csv(client, citizen, admin_headers):
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)
    resp = client.get("/api/admin/districts/1/report.csv", headers=admin_headers)
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in resp.headers["content-disposition"]
    import csv
    import io

    rows = {r[0]: r[1:] for r in csv.reader(io.StringIO(resp.text)) if r}
    assert rows["Registered citizens"] == ["1"] and rows["Actions, last 30 days"] == ["1"]
    assert "Leading ward" in rows and "@" not in resp.text  # no emails; wards under 5 households are left out
    assert "Ward 3" not in resp.text
    assert client.get("/api/admin/districts/1/report.csv", headers=citizen).status_code == 403


def test_footprint_history_by_month(client, citizen):
    from app.services import factors

    client.post("/api/readings", json={"month": "2026-01", "kwh": 250}, headers=citizen)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)
    data = client.get("/api/footprint/history", headers=citizen).json()
    jan = next(m for m in data["months"] if m["month"] == "2026-01")
    assert jan["electricity_kg"] == round(250 * factors.GRID_KG_CO2_PER_KWH, 1)
    assert jan["total_kg"] == round(jan["electricity_kg"] + jan["cooking_kg"] + jan["commute_kg"], 1)
    assert jan["avoided_kg"] == 0 and jan["actions"] == 0
    this_month = data["months"][-1]
    assert this_month["actions"] == 1 and this_month["avoided_kg"] > 0  # today's walk
    assert data["baseline_kg"] > 0 and [m["month"] for m in data["months"]] == sorted(m["month"] for m in data["months"])


def test_appliance_upgrade_priced_at_household_tariff(client, citizen):
    from app.services import factors
    from app.services.footprint import electricity_bill_rs

    # A 3-star 1.5 t AC label says 1,100 kWh/year; the 5-star model says 800.
    body = {"appliance": "ac", "old_kwh_per_year": 1100, "new_kwh_per_year": 800, "new_price_rs": 42000}
    data = client.post("/api/appliances/compare", json=body, headers=citizen).json()
    # The citizen fixture uses 300 kWh a month on the default tariff.
    expected = 12 * (electricity_bill_rs(300) - electricity_bill_rs(300 - 300 / 12))
    assert data["kwh_saved_per_year"] == 300
    assert data["rs_saved_per_year"] == round(expected)
    assert data["co2_saved_kg_per_year"] == round(300 * factors.GRID_KG_CO2_PER_KWH, 1)
    assert data["payback_years"] == round(42000 / expected, 1)
    worse = {**body, "new_kwh_per_year": 1300}
    assert client.post("/api/appliances/compare", json=worse, headers=citizen).json()["payback_years"] is None


def test_share_card_is_a_png_with_first_name_only(client, citizen, monkeypatch):
    import io

    from PIL import Image

    from app.routers import household

    client.patch("/api/auth/me", json={"name": "Asha Patel"}, headers=citizen)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=citizen)
    resp = client.get("/api/share/card.png", headers=citizen)
    assert resp.status_code == 200 and resp.headers["content-type"] == "image/png"
    assert Image.open(io.BytesIO(resp.content)).size == (1080, 1080)

    seen = {}
    real = household.render_card
    monkeypatch.setattr(household, "render_card", lambda **kw: seen.update(kw) or real(**kw))
    client.get("/api/share/card.png", headers=citizen)
    assert seen["first_name"] == "Asha" and seen["district"] == "Ahmedabad" and seen["actions"] == 1
    assert "Patel" not in str(seen) and "@" not in str(seen)  # no surname or email reaches the image
    assert client.get("/api/share/card.png").status_code == 401


def test_district_officer_sees_only_their_district(client, citizen, admin_headers):
    from app.create_admin import create_admin

    other = register(client, email="ravi@example.com", district_id=2)
    client.put("/api/household", json=HOUSEHOLD, headers=other)
    pics = [photo(40), photo(41)]
    for headers, pic in ((citizen, pics[0]), (other, pics[1])):
        client.post("/api/actions", data={"action_code": "plant_tree"},
                    files={"proof": ("t.png", pic, "image/png")}, headers=headers)

    create_admin("officer@example.com", "District Officer", "officer-pass-1", district="ahmedabad")
    login = client.post("/api/auth/login", json={"email": "officer@example.com", "password": "officer-pass-1"}).json()
    officer = {"Authorization": f"Bearer {login['token']}"}
    assert login["user"]["role"] == "officer" and login["user"]["district_id"] == 1

    queue = client.get("/api/admin/reviews", headers=officer).json()
    assert [r["district"] for r in queue] == ["Ahmedabad"]
    assert len(client.get("/api/admin/reviews", headers=admin_headers).json()) == 2
    assert client.get("/api/admin/districts/1", headers=officer).status_code == 200
    assert client.get("/api/admin/districts/2", headers=officer).status_code == 403
    assert client.get("/api/admin/districts/2/report.csv", headers=officer).status_code == 403
    assert client.get("/api/admin/solar-scenario", headers=officer).json()["district"] == "Ahmedabad"
    assert all(e["district"] == "Ahmedabad" for e in client.get("/api/admin/activity", headers=officer).json())
    other_log = next(r for r in client.get("/api/admin/reviews", headers=admin_headers).json() if r["district"] != "Ahmedabad")
    assert client.post(f"/api/admin/reviews/{other_log['id']}", json={"approve": True}, headers=officer).status_code == 403


def test_reviewer_and_auditor_roles(client, citizen, admin_headers):
    from app.create_admin import create_admin

    log = client.post("/api/actions", data={"action_code": "plant_tree"},
                      files={"proof": ("t.png", photo(60), "image/png")}, headers=citizen).json()

    def sign_in(email, role, **kw):
        create_admin(email, role.title(), "staff-pass-1", role=role, **kw)
        token = client.post("/api/auth/login", json={"email": email, "password": "staff-pass-1"}).json()["token"]
        return {"Authorization": f"Bearer {token}"}

    reviewer = sign_in("rev@example.com", "reviewer")
    auditor = sign_in("aud@example.com", "auditor")

    # A reviewer works the queue but sees no analytics.
    assert len(client.get("/api/admin/reviews", headers=reviewer).json()) == 1
    assert client.get("/api/admin/overview", headers=reviewer).status_code == 403
    # An auditor sees everything and changes nothing.
    assert client.get("/api/admin/overview", headers=auditor).status_code == 200
    assert client.get("/api/admin/reviews", headers=auditor).status_code == 403
    assert client.post(f"/api/admin/reviews/{log['id']}", json={"approve": True}, headers=auditor).status_code == 403
    assert client.post(f"/api/admin/reviews/{log['id']}", json={"approve": True}, headers=reviewer).status_code == 204

    scoped = sign_in("rev2@example.com", "reviewer", district="Surat")
    assert client.get("/api/admin/reviews", headers=scoped).json() == []  # nothing from Ahmedabad


def test_cors_allows_the_known_web_addresses_and_nobody_else(client):
    def preflight(origin):
        return client.options("/api/districts", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})

    for ok in ("https://nidhi-gujarat.vercel.app", "https://lifeline-" + "cyan-rho.vercel.app"):
        assert preflight(ok).headers.get("access-control-allow-origin") == ok
    assert preflight("https://evil.vercel.app").status_code == 400
    assert preflight("https://nidhi-gujarat.vercel.app.evil.com").status_code == 400
