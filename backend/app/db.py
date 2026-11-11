from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

def _connect_args(url: str) -> dict:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    # Supabase's Supavisor pooler (port 6543) runs in transaction mode, where server-side
    # prepared statements break; psycopg must not create them.
    if ":6543/" in url or "pooler.supabase.com" in url:
        return {"prepare_threshold": None}
    return {}



engine = create_engine(settings.database_url, connect_args=_connect_args(settings.database_url), pool_pre_ping=True)

if settings.database_url.startswith("sqlite"):
    # SQLite ignores foreign keys unless asked; enforce them so local runs fail where Postgres would.
    @event.listens_for(engine, "connect")
    def _sqlite_foreign_keys(conn, _record) -> None:
        conn.execute("PRAGMA foreign_keys=ON")
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
