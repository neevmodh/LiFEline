"""solar leads: households asking GEDA for a rooftop survey

Revision ID: c7d2e4f6a8b1
Revises: b3e7f1a9c2d4
"""

import sqlalchemy as sa
from alembic import op

revision = "c7d2e4f6a8b1"
down_revision = "b3e7f1a9c2d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "solar_leads",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("district_id", sa.Integer(), sa.ForeignKey("districts.id"), nullable=True),
        sa.Column("kwp", sa.Float(), nullable=False),
        sa.Column("roof_area_sqm", sa.Float(), nullable=False),
        sa.Column("monthly_kwh", sa.Float(), nullable=False),
        sa.Column("note", sa.String(300), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("staff_note", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_solar_leads_user_id", "solar_leads", ["user_id"])
    op.create_index("ix_solar_leads_district_id", "solar_leads", ["district_id"])
    op.create_index("ix_solar_leads_status", "solar_leads", ["status"])
    # Row Level Security like every other table: only the API's own role reads and writes.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE solar_leads ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_index("ix_solar_leads_status", "solar_leads")
    op.drop_index("ix_solar_leads_district_id", "solar_leads")
    op.drop_index("ix_solar_leads_user_id", "solar_leads")
    op.drop_table("solar_leads")
