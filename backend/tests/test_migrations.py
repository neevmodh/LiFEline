import os

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text

from app.db import Base
from app.migrate import alembic_config


def test_migrations_match_models(tmp_path):
    """Upgrading an empty database must produce exactly the schema the models declare."""
    engine = create_engine(os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path}/migrated.db")
    Base.metadata.drop_all(engine)
    cfg = alembic_config()
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], f"Models changed without a migration: {diff}"

    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.downgrade(cfg, "base")
        conn.execute(text("DROP TABLE alembic_version"))
    engine.dispose()
