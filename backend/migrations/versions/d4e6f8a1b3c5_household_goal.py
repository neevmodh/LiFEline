"""household goal: a percentage below the starting point

Revision ID: d4e6f8a1b3c5
Revises: c7d2e4f6a8b1
"""

import sqlalchemy as sa
from alembic import op

revision = "d4e6f8a1b3c5"
down_revision = "c7d2e4f6a8b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("households", sa.Column("goal_pct", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("households", "goal_pct")
