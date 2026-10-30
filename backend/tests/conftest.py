import os
import tempfile

# Must be set before the app (and its settings/engine) is imported.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["ENABLE_EXTERNAL_APIS"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402
from app.security import create_access_token, hash_password  # noqa: E402

HOUSEHOLD = {
    "monthly_kwh": 300,
    "members": 4,
    "lpg_cylinders_per_month": 1,
    "commute_mode": "car",
    "commute_km_per_day": 8,
    "home_type": "independent",
    "ac_count": 2,
    "has_geyser": True,
    "has_washing_machine": True,
    "has_ev": False,
    "has_solar": False,
    "roof_area_sqm": 40,
}


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:  # lifespan creates tables and seeds reference data
        yield c


def register(client, email="asha@example.com", district_id=1) -> dict:
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": "secret123", "name": "Asha", "district_id": district_id, "ward": "Ward 3"},
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['token']}"}


@pytest.fixture()
def citizen(client) -> dict:
    headers = register(client)
    assert client.put("/api/household", json=HOUSEHOLD, headers=headers).status_code == 200
    return headers


@pytest.fixture()
def admin_headers(client) -> dict:
    with SessionLocal() as db:
        admin = User(email="admin@example.com", name="Admin", role=Role.admin, password_hash=hash_password("x" * 8))
        db.add(admin)
        db.commit()
        return {"Authorization": f"Bearer {create_access_token(admin.id)}"}
