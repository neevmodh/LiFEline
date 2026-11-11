"""action_types.theme: the seven Mission LiFE themes

Revision ID: b7e2c5a9d104
Revises: a1d6e4b9c7f2
Create Date: 2026-11-11 12:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7e2c5a9d104"
down_revision: str | Sequence[str] | None = "a1d6e4b9c7f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("action_types") as batch:
        batch.add_column(sa.Column("theme", sa.String(length=20), nullable=False, server_default="energy"))


def downgrade() -> None:
    with op.batch_alter_table("action_types") as batch:
        batch.drop_column("theme")
