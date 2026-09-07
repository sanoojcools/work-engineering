"""INTENT-LITE columns on work_systems + moderation_entries table

Revision ID: ac2a876395e4
Revises: 549fc2e9287a
Create Date: 2026-09-07 00:00:00.000000

Two intents attached to the one existing Work System row (D — INTENT-LITE,
docs/BUILD_PROGRAM.md): Function intent (HR operations) and Work System
intent. Persisted as columns on work_systems, not a child table -- exactly
two fixed intents exist, ever (docs/INTENT_CONTRACT.md's "no INT-007, or
any other, new identifier or table for intent records" still holds; this
is not that -- it is two named, single-row fields on an already-tenant-
scoped table, same shape as that table's own entry/exit/owner/outcome).
Each intent's *_confirmed_by / *_confirmed_at pair is null (draft) until a
keyed "Confirm as owner" click sets both together -- draft vs confirmed is
derived from confirmed_at being null, not a separate status column, so the
two can never disagree.

moderation_entries is new: a real, append-only log of "move S2 toward S3"
requests against a real Work Unit code, each row requiring a reason and a
name at write time (enforced by the schema, not just the UI). It never
changes verdict_scores, work_units, or any hard gate -- it is a logged
opinion, not the VERDICT promotion ladder (BUILD_PROGRAM.md's "no ladder"
refusal). Same RLS shape as work_systems' own migration (549fc2e9287a).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac2a876395e4'
down_revision: Union[str, Sequence[str], None] = '549fc2e9287a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"


def upgrade() -> None:
    # --- D: INTENT-LITE columns on work_systems ---
    op.add_column('work_systems', sa.Column('function_intent_outcome', sa.Text(), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('function_intent_owner', sa.String(length=160), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('function_intent_measure', sa.Text(), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('function_intent_confirmed_by', sa.String(length=120), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('function_intent_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('work_systems', sa.Column('work_system_intent_purpose', sa.Text(), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('work_system_intent_owner', sa.String(length=160), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('work_system_intent_confirmed_by', sa.String(length=120), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('work_system_intent_confirmed_at', sa.DateTime(timezone=True), nullable=True))

    # --- E: moderation_entries ---
    op.create_table(
        'moderation_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('work_unit_code', sa.String(length=40), nullable=False),
        sa.Column('from_level', sa.Integer(), nullable=False),
        sa.Column('to_level', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=2000), nullable=False),
        sa.Column('moderated_by', sa.String(length=120), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_moderation_entries_client', 'moderation_entries', ['client_id'], unique=False)

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_entries TO wep_app")
    op.execute("GRANT USAGE, SELECT ON moderation_entries_id_seq TO wep_app")

    op.execute("ALTER TABLE moderation_entries ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE moderation_entries FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON moderation_entries FOR ALL "
        f"USING (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON moderation_entries")
    op.execute("ALTER TABLE moderation_entries NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE moderation_entries DISABLE ROW LEVEL SECURITY")
    op.drop_index('ix_moderation_entries_client', table_name='moderation_entries')
    op.drop_table('moderation_entries')

    op.drop_column('work_systems', 'work_system_intent_confirmed_at')
    op.drop_column('work_systems', 'work_system_intent_confirmed_by')
    op.drop_column('work_systems', 'work_system_intent_owner')
    op.drop_column('work_systems', 'work_system_intent_purpose')
    op.drop_column('work_systems', 'function_intent_confirmed_at')
    op.drop_column('work_systems', 'function_intent_confirmed_by')
    op.drop_column('work_systems', 'function_intent_measure')
    op.drop_column('work_systems', 'function_intent_owner')
    op.drop_column('work_systems', 'function_intent_outcome')
