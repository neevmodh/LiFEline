"""climate months: observed district weather for weather-adjusted savings

Revision ID: 9a4f3c2e8d71
Revises: 7c1e2a9d4b10
Create Date: 2026-11-09 10:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9a4f3c2e8d71"
down_revision: str | Sequence[str] | None = "7c1e2a9d4b10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "climate_months",
        sa.Column("district_id", sa.Integer(), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("cooling_degree_days", sa.Float(), nullable=False),
        sa.Column("mean_temp_c", sa.Float(), nullable=False),
        sa.Column("days_observed", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"]),
        sa.PrimaryKeyConstraint("district_id", "month"),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE climate_months ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("climate_months")
