"""Signing up with a mobile number, then signing in with it instead of the email."""

import pytest

from app.schemas import normalize_phone


def _register(client, **extra):
    body = {"email": "meera@example.com", "password": "secret123", "name": "Meera", "district_id": 1, **extra}
    return client.post("/api/auth/register", json=body)


@pytest.mark.parametrize(
    "raw,clean",
    [("98765 43210", "9876543210"), ("+91 98765-43210", "9876543210"), ("09876543210", "9876543210"), ("", None), (None, None)],
)
def test_numbers_are_normalized(raw, clean):
    assert normalize_phone(raw) == clean


@pytest.mark.parametrize("bad", ["12345", "5876543210", "98765432101", "abcdefghij"])
def test_bad_numbers_are_refused(bad):
    with pytest.raises(ValueError):
        normalize_phone(bad)


def test_sign_in_with_the_mobile_number(client):
    resp = _register(client, phone="+91 98765 43210")
    assert resp.status_code == 201
    assert resp.json()["user"]["phone"] == "9876543210"

    ok = client.post("/api/auth/login", json={"phone": "98765 43210", "password": "secret123"})
    assert ok.status_code == 200
    assert ok.json()["user"]["email"] == "meera@example.com"

    wrong = client.post("/api/auth/login", json={"phone": "9876543210", "password": "not-it-at-all"})
    assert wrong.status_code == 401
    assert "mobile" in wrong.json()["detail"]

    # The email still works for the same account.
    assert client.post("/api/auth/login", json={"email": "meera@example.com", "password": "secret123"}).status_code == 200


def test_unknown_number_is_a_plain_401(client):
    _register(client)
    assert client.post("/api/auth/login", json={"phone": "9123456789", "password": "secret123"}).status_code == 401


def test_a_number_belongs_to_one_account(client):
    assert _register(client, phone="9876543210").status_code == 201
    again = client.post(
        "/api/auth/register",
        json={"email": "other@example.com", "password": "secret123", "name": "O", "district_id": 1, "phone": "98765 43210"},
    )
    assert again.status_code == 409


def test_login_needs_an_email_or_a_number(client):
    assert client.post("/api/auth/login", json={"password": "secret123"}).status_code == 422
    assert _register(client, phone="12345").status_code == 422
