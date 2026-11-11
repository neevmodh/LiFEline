"""duels.created_by and campaigns.created_by may be null after their creator deletes their account

Revision ID: a7d2e9c4b318
Revises: f1c6d8a2e935
Create Date: 2026-11-11 21:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7d2e9c4b318"
down_revision: str | Sequence[str] | None = "f1c6d8a2e935"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("duels", "campaigns"):
        with op.batch_alter_table(table) as batch:
            batch.alter_column("created_by", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    for table in ("duels", "campaigns"):
        with op.batch_alter_table(table) as batch:
            batch.alter_column("created_by", existing_type=sa.Integer(), nullable=False)
