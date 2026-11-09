"""campaigns: time-boxed challenges with a shared target

Revision ID: e8a4c2d7b1f6
Revises: d3b8f1a6c9e2
Create Date: 2026-11-10 15:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e8a4c2d7b1f6"
down_revision: str | Sequence[str] | None = "d3b8f1a6c9e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("action_code", sa.String(length=40), nullable=True),
        sa.Column("target", sa.Integer(), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("scope", sa.String(length=10), nullable=False),
        sa.Column("scope_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("campaigns")
