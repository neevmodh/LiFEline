from app.services import factors
from conftest import HOUSEHOLD, register


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
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
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
