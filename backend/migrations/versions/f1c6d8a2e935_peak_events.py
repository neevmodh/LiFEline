"""campaigns.kind, start_hour, end_hour: Peak Hour Challenge events

Revision ID: f1c6d8a2e935
Revises: e5a8c1f3b627
Create Date: 2026-11-11 17:30:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1c6d8a2e935"
down_revision: str | Sequence[str] | None = "e5a8c1f3b627"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("campaigns") as batch:
        batch.add_column(sa.Column("kind", sa.String(length=10), nullable=False, server_default="challenge"))
        batch.add_column(sa.Column("start_hour", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("end_hour", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("campaigns") as batch:
        batch.drop_column("end_hour")
        batch.drop_column("start_hour")
        batch.drop_column("kind")
