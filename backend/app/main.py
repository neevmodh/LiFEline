import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db import SessionLocal
from app.migrate import upgrade_to_head
from app.routers import actions, admin, auth, engage, household, insights, meta
from app.seed import seed_reference

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Single dev process: prepare the database in-process. With several workers this must
    # run once beforehand (see the Dockerfile), or the workers race to insert the same rows.
    if get_settings().auto_migrate:
        upgrade_to_head()
        with SessionLocal() as db:
            seed_reference(db)
    yield


app = FastAPI(title="LiFEline API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, household.router, actions.router, engage.router, admin.router, meta.router, insights.router):
    app.include_router(r)


@app.get("/api/health")
def health(response: Response):
    """Liveness plus the state of each dependency, for the host's health checks and the booth.

    The API stays up (200) when an optional service is missing, since every one of them
    has a fallback; only an unreachable database makes it unhealthy (503).
    """
    settings = get_settings()
    checks: dict[str, str] = {}
    try:
        started = time.perf_counter()
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks["database"] = f"ok ({(time.perf_counter() - started) * 1000:.0f} ms)"
    except SQLAlchemyError:
        checks["database"] = "unreachable"
        response.status_code = 503
    checks["photo_storage"] = settings.storage_backend
    checks["ai_reader"] = "groq" if settings.groq_api_key else "anthropic" if settings.anthropic_api_key else "on-device only"
    checks["external_data"] = "on" if settings.enable_external_apis else "offline defaults"
    return {"status": "ok" if response.status_code != 503 else "degraded", "checks": checks}
