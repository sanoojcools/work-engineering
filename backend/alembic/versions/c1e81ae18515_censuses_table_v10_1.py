"""censuses table V10-1

Revision ID: c1e81ae18515
Revises: ac2a876395e4
Create Date: 2026-09-07 18:30:53.541031

One row per (tenant, work_system) Work Census (docs/V10_BUILD.md V10-1).
Same RLS shape as the most recent tenant-scoped table (549fc2e9287a's
work_systems): direct client_id + tenant_isolation policy, with the
app.system_bypass clause baked in from the start rather than bolted on
later (see 68c3926e1143).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1e81ae18515'
down_revision: Union[str, Sequence[str], None] = 'ac2a876395e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"


def upgrade() -> None:
    op.create_table(
        'censuses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('work_system_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('draft', 'started', name='censusstatus'), nullable=False),
        sa.Column('scope', sa.Text(), nullable=False),
        sa.Column('document_requests', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['work_system_id'], ['work_systems.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', 'work_system_id', name='uq_censuses_client_work_system'),
    )
    op.create_index('ix_censuses_client', 'censuses', ['client_id'], unique=False)

    # wep_app's default privileges (f198c4aadd2c) already cover future
    # tables created by wep -- explicit anyway, matching work_systems'/
    # ratifications' own belt-and-suspenders convention.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON censuses TO wep_app")
    op.execute("GRANT USAGE, SELECT ON censuses_id_seq TO wep_app")

    op.execute("ALTER TABLE censuses ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE censuses FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON censuses FOR ALL "
        f"USING (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON censuses")
    op.execute("ALTER TABLE censuses NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE censuses DISABLE ROW LEVEL SECURITY")

    op.drop_index('ix_censuses_client', table_name='censuses')
    op.drop_table('censuses')
    op.execute("DROP TYPE IF EXISTS censusstatus")
