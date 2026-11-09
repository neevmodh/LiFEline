"""district officers: a GEDA role scoped to one district

Revision ID: b5d2e8c1f4a3
Revises: 9a4f3c2e8d71
Create Date: 2026-11-09 20:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b5d2e8c1f4a3"
down_revision: str | Sequence[str] | None = "9a4f3c2e8d71"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = sa.Enum("citizen", "admin", name="role")
NEW = sa.Enum("citizen", "admin", "officer", name="role")


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'officer'")
    else:
        with op.batch_alter_table("users") as batch:
            batch.alter_column("role", existing_type=OLD, type_=NEW, existing_nullable=False)


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'officer'")
    if op.get_bind().dialect.name != "postgresql":  # Postgres can't drop an enum value; harmless to keep
        with op.batch_alter_table("users") as batch:
            batch.alter_column("role", existing_type=NEW, type_=OLD, existing_nullable=False)
