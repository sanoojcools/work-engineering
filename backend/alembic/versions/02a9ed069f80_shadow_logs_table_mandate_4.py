"""shadow_logs table (MANDATE-4)

Revision ID: 02a9ed069f80
Revises: f1a2b3c4d5e6
Create Date: 2026-09-14 00:00:00.000000

In-app self-reported finish times for one piece of work -- no Slack, no
Workday, no Clerk. Same RLS shape as work_systems (549fc2e9287a): direct
client_id + tenant_isolation policy, app.system_bypass clause baked in from
the start.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02a9ed069f80'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"


def upgrade() -> None:
    op.create_table(
        'shadow_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('work_unit_id', sa.Integer(), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('note', sa.String(length=240), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['work_unit_id'], ['work_units.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', 'work_unit_id', 'occurred_at', name='uq_shadow_logs_client_unit_occurred'),
    )
    op.create_index('ix_shadow_logs_client', 'shadow_logs', ['client_id'], unique=False)
    op.create_index('ix_shadow_logs_work_unit', 'shadow_logs', ['work_unit_id'], unique=False)

    # wep_app's default privileges (f198c4aadd2c) already cover future
    # tables created by wep -- explicit anyway, matching work_systems'
    # own belt-and-suspenders convention.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON shadow_logs TO wep_app")
    op.execute("GRANT USAGE, SELECT ON shadow_logs_id_seq TO wep_app")

    op.execute("ALTER TABLE shadow_logs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE shadow_logs FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON shadow_logs FOR ALL "
        f"USING (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON shadow_logs")
    op.execute("ALTER TABLE shadow_logs NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE shadow_logs DISABLE ROW LEVEL SECURITY")

    op.drop_index('ix_shadow_logs_work_unit', table_name='shadow_logs')
    op.drop_index('ix_shadow_logs_client', table_name='shadow_logs')
    op.drop_table('shadow_logs')
