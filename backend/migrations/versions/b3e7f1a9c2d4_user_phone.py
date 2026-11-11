"""users.phone: an optional Indian mobile number to sign in with instead of the email

Revision ID: b3e7f1a9c2d4
Revises: a7d2e9c4b318
Create Date: 2026-11-11 23:30:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b3e7f1a9c2d4"
down_revision: str | Sequence[str] | None = "a7d2e9c4b318"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("phone", sa.String(length=10), nullable=True))
        batch.create_index("ix_users_phone", ["phone"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_phone")
        batch.drop_column("phone")
