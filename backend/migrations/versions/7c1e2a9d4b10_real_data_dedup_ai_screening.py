"""real data: per-log impact, DISCOM tariffs, duplicate photos, AI screening, RLS

Revision ID: 7c1e2a9d4b10
Revises: 1b6df364455e
Create Date: 2026-11-08 23:00:00

"""
import re
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "7c1e2a9d4b10"
down_revision: Union[str, Sequence[str], None] = "1b6df364455e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ["districts", "users", "households", "energy_readings", "action_types", "action_logs", "alembic_version"]


def _normalise_ward(value):
    # Same rule as app.schemas.normalise_ward, frozen here so the migration never changes.
    if value is None:
        return None
    text = " ".join(value.replace("_", " ").split())
    if not text:
        return None
    m = re.fullmatch(r"(?:ward)?\s*(?:no\.?|number|#)?\s*[-:.]?\s*0*(\d+)", text, flags=re.IGNORECASE)
    if m:
        return f"Ward {int(m.group(1))}"
    return text.title() if text.islower() or text.isupper() else text


def upgrade() -> None:
    with op.batch_alter_table("households") as batch:
        batch.add_column(sa.Column("discom", sa.String(length=20), server_default="ugvcl", nullable=False))
        batch.add_column(sa.Column("area", sa.String(length=10), server_default="urban", nullable=False))

    with op.batch_alter_table("action_logs") as batch:
        batch.add_column(sa.Column("kwh_saved", sa.Float(), server_default="0", nullable=False))
        batch.add_column(sa.Column("proof_hash", sa.String(length=16), nullable=True))
        batch.add_column(sa.Column("ai_verdict", sa.String(length=10), nullable=True))
        batch.add_column(sa.Column("ai_confidence", sa.Float(), nullable=True))
        batch.add_column(sa.Column("ai_reason", sa.String(length=300), nullable=True))
        batch.create_index("ix_action_logs_proof_hash", ["proof_hash"])

    conn = op.get_bind()
    # Existing logs keep the catalogue's kWh figure; counted totals stay the same.
    conn.execute(sa.text(
        "UPDATE action_logs SET kwh_saved = (SELECT kwh_saved FROM action_types WHERE action_types.id = action_logs.action_type_id) "
        "WHERE status IN ('self_reported', 'verified')"
    ))
    for user_id, ward in conn.execute(sa.text("SELECT id, ward FROM users WHERE ward IS NOT NULL")).all():
        clean = _normalise_ward(ward)
        if clean != ward:
            conn.execute(sa.text("UPDATE users SET ward = :w WHERE id = :id"), {"w": clean, "id": user_id})

    if conn.dialect.name == "postgresql":
        # Supabase publishes the public schema through its REST API. With RLS on and no
        # policies, the anon and authenticated keys see nothing; only the API's own
        # database role (the table owner) reads and writes.
        for table in TABLES:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        for table in TABLES:
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    with op.batch_alter_table("action_logs") as batch:
        batch.drop_index("ix_action_logs_proof_hash")
        for col in ("ai_reason", "ai_confidence", "ai_verdict", "proof_hash", "kwh_saved"):
            batch.drop_column(col)
    with op.batch_alter_table("households") as batch:
        batch.drop_column("area")
        batch.drop_column("discom")
