"""translation cache: machine translations of text people type, stored once per language

Revision ID: a9d3f5b7c1e2
Revises: d4e6f8a1b3c5
"""

import sqlalchemy as sa
from alembic import op

revision = "a9d3f5b7c1e2"
down_revision = "d4e6f8a1b3c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "translation_cache",
        sa.Column("source_hash", sa.String(64), primary_key=True),
        sa.Column("lang", sa.String(5), primary_key=True),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Row Level Security like every other table: only the API's own role reads and writes.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("translation_cache")
