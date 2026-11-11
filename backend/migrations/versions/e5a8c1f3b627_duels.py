"""duels: two communities, 30 days, CO2 per household

Revision ID: e5a8c1f3b627
Revises: d9b3e6f1a274
Create Date: 2026-11-11 16:30:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e5a8c1f3b627"
down_revision: str | Sequence[str] | None = "d9b3e6f1a274"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "duels",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("challenger_id", sa.Integer(), sa.ForeignKey("societies.id"), nullable=False),
        sa.Column("opponent_id", sa.Integer(), sa.ForeignKey("societies.id"), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_duels_challenger_id", "duels", ["challenger_id"])
    op.create_index("ix_duels_opponent_id", "duels", ["opponent_id"])


def downgrade() -> None:
    op.drop_index("ix_duels_opponent_id", table_name="duels")
    op.drop_index("ix_duels_challenger_id", table_name="duels")
    op.drop_table("duels")
