"""societies.kind: society, college, school, office or ward

Revision ID: c4f7a2e8d913
Revises: b7e2c5a9d104
Create Date: 2026-11-11 15:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c4f7a2e8d913"
down_revision: str | Sequence[str] | None = "b7e2c5a9d104"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing rows become "society" through the server default.
    with op.batch_alter_table("societies") as batch:
        batch.add_column(sa.Column("kind", sa.String(length=10), nullable=False, server_default="society"))


def downgrade() -> None:
    with op.batch_alter_table("societies") as batch:
        batch.drop_column("kind")
