import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import SessionLocal
from app.migrate import upgrade_to_head
from app.routers import actions, admin, auth, engage, household
from app.seed import seed_reference

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
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

for r in (auth.router, household.router, actions.router, engage.router, admin.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
