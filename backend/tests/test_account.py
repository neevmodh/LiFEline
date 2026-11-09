"""Download and erase your own data."""

import pytest

from app.models import ActionLog, EnergyReading, Household, PushSubscription, User
from conftest import HOUSEHOLD, photo, register


@pytest.fixture()
def two_citizens(client):
    asha = register(client)
    client.put("/api/household", json=HOUSEHOLD, headers=asha)
    ravi = register(client, email="ravi@example.com")
    client.put("/api/household", json=HOUSEHOLD, headers=ravi)
    return asha, ravi


def test_export_has_my_data_and_not_a_password_or_others(client, two_citizens):
    asha, ravi = two_citizens
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=asha)
    client.post("/api/actions", data={"action_code": "geyser_off"}, headers=ravi)
    resp = client.get("/api/account/export", headers=asha)
    assert resp.status_code == 200 and "attachment" in resp.headers["content-disposition"]
    data = resp.json()
    assert data["account"]["email"] == "asha@example.com" and data["household"]["monthly_kwh"] == 300
    assert [a["action"] for a in data["actions"]] == ["cycle_walk"] and data["bill_readings"][0]["source"] == "onboarding"
    text = resp.text
    assert "ravi@example.com" not in text and "password" not in text.lower().replace("your password is stored", "")
    assert "$2b$" not in text  # no bcrypt hash
    assert client.get("/api/account/export").status_code == 401


def test_delete_needs_the_right_password(client, two_citizens):
    asha, _ = two_citizens
    assert client.request("DELETE", "/api/account", json={"password": "wrong-pass"}, headers=asha).status_code == 403
    assert client.get("/api/auth/me", headers=asha).status_code == 200  # still there


def test_delete_erases_everything_including_photos(client, two_citizens, monkeypatch):
    from app import storage as storage_module
    from app.db import SessionLocal

    asha, ravi = two_citizens
    client.post("/api/actions", data={"action_code": "plant_tree"},
                files={"proof": ("t.png", photo(50), "image/png")}, headers=asha)
    client.post("/api/actions", data={"action_code": "cycle_walk"}, headers=ravi)
    client.post("/api/push/subscribe", json={"endpoint": "https://push.example.com/a",
                                             "keys": {"p256dh": "k" * 40, "auth": "a" * 16}}, headers=asha)
    removed = []
    real = storage_module.LocalStorage.delete

    async def spy(self, name):
        removed.append(name)
        await real(self, name)

    monkeypatch.setattr(storage_module.LocalStorage, "delete", spy)

    resp = client.request("DELETE", "/api/account", json={"password": "secret123"}, headers=asha)
    assert resp.status_code == 204 and len(removed) == 1  # the one photo was erased from storage

    assert client.get("/api/auth/me", headers=asha).status_code == 401
    assert client.post("/api/auth/login", json={"email": "asha@example.com", "password": "secret123"}).status_code == 401
    with SessionLocal() as db:
        assert db.query(User).filter(User.email == "asha@example.com").count() == 0
        for model in (Household, EnergyReading, ActionLog, PushSubscription):
            assert db.query(model).filter(model.user_id == 1).count() == 0
        assert db.query(User).filter(User.email == "ravi@example.com").count() == 1  # others untouched
        assert db.query(ActionLog).count() == 1
    board = client.get("/api/leaderboard/users?scope=district", headers=ravi).json()
    assert [r["name"] for r in board] == ["Asha"] and len(board) == 1  # only Ravi (named Asha by the fixture)


def test_staff_accounts_cannot_self_delete_here(client, admin_headers):
    resp = client.request("DELETE", "/api/account", json={"password": "xxxxxxxx"}, headers=admin_headers)
    assert resp.status_code == 403


def test_the_email_can_be_reused_after_deletion(client, two_citizens):
    asha, _ = two_citizens
    client.request("DELETE", "/api/account", json={"password": "secret123"}, headers=asha)
    again = client.post("/api/auth/register", json={"email": "asha@example.com", "password": "newpass123", "name": "A", "district_id": 1})
    assert again.status_code == 201
