"""district_sun: cached PVGIS rooftop yield per district

Revision ID: a1d6e4b9c7f2
Revises: f2c9b7a3d5e1
Create Date: 2026-11-10 20:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1d6e4b9c7f2"
down_revision: str | Sequence[str] | None = "f2c9b7a3d5e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "district_sun",
        sa.Column("district_id", sa.Integer(), nullable=False),
        sa.Column("kwh_per_kwp", sa.Float(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"]),
        sa.PrimaryKeyConstraint("district_id"),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE district_sun ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("district_sun")
