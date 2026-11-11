"""push_subscriptions.channel: web or expo (the phone app)

Revision ID: d9b3e6f1a274
Revises: c4f7a2e8d913
Create Date: 2026-11-11 15:30:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d9b3e6f1a274"
down_revision: str | Sequence[str] | None = "c4f7a2e8d913"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("push_subscriptions") as batch:
        batch.add_column(sa.Column("channel", sa.String(length=5), nullable=False, server_default="web"))


def downgrade() -> None:
    with op.batch_alter_table("push_subscriptions") as batch:
        batch.drop_column("channel")
