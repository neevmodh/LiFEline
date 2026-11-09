import os
import tempfile

# Must be set before the app (and its settings/engine) is imported.
_tmp = tempfile.mkdtemp()
# Set TEST_DATABASE_URL to run the suite against Postgres (CI does).
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
# Never touch a real Supabase project from tests, even if backend/.env points at one.
os.environ["STORAGE_BACKEND"] = "local"
os.environ["MIGRATION_DATABASE_URL"] = os.environ["DATABASE_URL"]
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_KEY"] = ""
# Same for push alerts: tests configure their own keys when they need them.
for _name in ("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "PUSH_CRON_SECRET"):
    os.environ[_name] = ""
os.environ["ENABLE_EXTERNAL_APIS"] = "false"
os.environ["AUTO_MIGRATE"] = "false"
# Never call real AI providers from tests, even if backend/.env has keys.
os.environ["GROQ_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""  # tests build the schema from the models; test_migrations checks they agree

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Role, User  # noqa: E402
from app.seed import seed_reference  # noqa: E402
from app.ratelimit import bill_scan_limiter, login_limiter, register_limiter  # noqa: E402
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
    for limiter in (login_limiter, register_limiter, bill_scan_limiter):
        limiter.reset()
    import app.routers.auth as auth_router

    auth_router._districts_cache = None  # each test seeds a fresh database
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_reference(db)
    with TestClient(app) as c:
        yield c


def photo(seed: int = 1, fmt: str = "PNG", size: tuple[int, int] = (64, 48)) -> bytes:
    """A real image with a distinct pattern per seed, so each test photo is a different picture."""
    import io
    import random

    from PIL import Image

    rng = random.Random(seed)
    img = Image.new("RGB", size)
    img.putdata([tuple(rng.randrange(256) for _ in range(3)) for _ in range(size[0] * size[1])])
    img = img.resize((size[0] * 4, size[1] * 4), Image.Resampling.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, fmt)
    return buf.getvalue()


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
