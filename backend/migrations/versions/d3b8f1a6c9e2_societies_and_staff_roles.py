"""societies with committees, and two more GEDA roles (reviewer, auditor)

Revision ID: d3b8f1a6c9e2
Revises: c7a1d3e9b2f5
Create Date: 2026-11-10 12:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d3b8f1a6c9e2"
down_revision: str | Sequence[str] | None = "c7a1d3e9b2f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = sa.Enum("citizen", "admin", "officer", name="role")
NEW = sa.Enum("citizen", "admin", "officer", "reviewer", "auditor", name="role")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'reviewer'")
        op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'auditor'")
    else:
        with op.batch_alter_table("users") as batch:
            batch.alter_column("role", existing_type=OLD, type_=NEW, existing_nullable=False)

    op.create_table(
        "societies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("district_id", sa.Integer(), nullable=False),
        sa.Column("join_code", sa.String(length=10), nullable=False),
        sa.Column("goal_kg_month", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("join_code"),
    )
    op.create_index("ix_societies_district_id", "societies", ["district_id"])
    op.create_table(
        "society_members",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("society_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"]),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_society_members_society_id", "society_members", ["society_id"])
    op.create_table(
        "society_announcements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("society_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["society_id"], ["societies.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_society_announcements_society_id", "society_announcements", ["society_id"])
    if bind.dialect.name == "postgresql":
        for table in ("societies", "society_members", "society_announcements"):
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("society_announcements")
    op.drop_table("society_members")
    op.drop_table("societies")
    op.execute("UPDATE users SET role = 'admin' WHERE role IN ('reviewer', 'auditor')")
    if op.get_bind().dialect.name != "postgresql":
        with op.batch_alter_table("users") as batch:
            batch.alter_column("role", existing_type=NEW, type_=OLD, existing_nullable=False)
