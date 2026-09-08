"""outcome_records table V10-5

Revision ID: 0b996f6d42b7
Revises: f7d35a1c2c7b
Create Date: 2026-09-08 00:00:00.000000

docs/NEXT.md / docs/V10_BUILD.md ("Claude outcome_records"): one row per
Work System -- promised text, measured text nullable, status
not_measured|measured. Same RLS shape as verification_designs/certifications
(f7d35a1c2c7b, V10-3): FK through work_system_id -> work_systems.client_id,
since this table has no client_id column of its own, with the
app.system_bypass clause baked in from the start (68c3926e1143's convention
for every table created after it).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b996f6d42b7'
down_revision: Union[str, Sequence[str], None] = 'f7d35a1c2c7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"

_STATUS_ENUM = sa.Enum('not_measured', 'measured', name='outcomestatus')


def upgrade() -> None:
    op.create_table(
        'outcome_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_system_id', sa.Integer(), nullable=False),
        sa.Column('promised', sa.Text(), nullable=False),
        sa.Column('measured', sa.Text(), nullable=True),
        sa.Column('status', _STATUS_ENUM, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['work_system_id'], ['work_systems.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('work_system_id', name='uq_outcome_records_work_system'),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON outcome_records TO wep_app")
    op.execute("GRANT USAGE, SELECT ON outcome_records_id_seq TO wep_app")

    op.execute("ALTER TABLE outcome_records ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE outcome_records FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON outcome_records FOR ALL "
        f"USING (work_system_id IN (SELECT id FROM work_systems WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (work_system_id IN (SELECT id FROM work_systems WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON outcome_records")
    op.execute("ALTER TABLE outcome_records NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE outcome_records DISABLE ROW LEVEL SECURITY")
    op.drop_table('outcome_records')
    op.execute("DROP TYPE IF EXISTS outcomestatus")
