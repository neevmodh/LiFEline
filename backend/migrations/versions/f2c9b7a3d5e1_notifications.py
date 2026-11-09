"""notifications: in-app message centre

Revision ID: f2c9b7a3d5e1
Revises: e8a4c2d7b1f6
Create Date: 2026-11-11 10:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2c9b7a3d5e1"
down_revision: str | Sequence[str] | None = "e8a4c2d7b1f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("params", sa.String(length=500), nullable=False),
        sa.Column("url", sa.String(length=120), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
