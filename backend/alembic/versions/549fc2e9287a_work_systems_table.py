"""work_systems table (CENSUS-v0 Part B)

Revision ID: 549fc2e9287a
Revises: b2c3d4e5f6a7
Create Date: 2026-09-07 00:00:00.000000

One row per named cross-desk journey a tenant has actually seen (this slice
seeds exactly one: the Offer Desk -> Onboarding journey). Same RLS shape as
the most recent tenant-scoped table (efc855b7d06a's users table): direct
client_id + tenant_isolation policy, with the app.system_bypass clause
baked in from the start rather than bolted on later.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '549fc2e9287a'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"


def upgrade() -> None:
    op.create_table(
        'work_systems',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=40), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('entry', sa.Text(), nullable=False),
        sa.Column('exit', sa.Text(), nullable=False),
        sa.Column('owner', sa.String(length=160), nullable=False),
        sa.Column('outcome', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('candidate', 'ratified', name='worksystemstatus'), nullable=False),
        sa.Column('ratified_by', sa.String(length=120), nullable=False),
        sa.Column('ratified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', 'code', name='uq_work_systems_client_code'),
    )
    op.create_index('ix_work_systems_client', 'work_systems', ['client_id'], unique=False)

    # wep_app's default privileges (f198c4aadd2c) already cover future
    # tables created by wep -- explicit anyway, matching 69290a7410da /
    # efc855b7d06a's own belt-and-suspenders convention.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON work_systems TO wep_app")
    op.execute("GRANT USAGE, SELECT ON work_systems_id_seq TO wep_app")

    op.execute("ALTER TABLE work_systems ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE work_systems FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON work_systems FOR ALL "
        f"USING (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON work_systems")
    op.execute("ALTER TABLE work_systems NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE work_systems DISABLE ROW LEVEL SECURITY")

    op.drop_index('ix_work_systems_client', table_name='work_systems')
    op.drop_table('work_systems')
    op.execute("DROP TYPE IF EXISTS worksystemstatus")
