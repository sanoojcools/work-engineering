"""verification_designs + certifications tables V10-3

Revision ID: f7d35a1c2c7b
Revises: 55df2bc65a11
Create Date: 2026-09-08 00:00:00.000000

V10-3 contract (docs/contracts/v10-3-verify.md): one row per Work Unit in
each of two separate tables -- `verification_designs` (method / independent /
sampling / cost_of_check / dual_track) and `certifications` (`class`,
kept apart from provenance and field_pointers per the contract).

Same RLS shape as `field_pointers` (afca8777b3bd, V10-2): FK through
work_unit_id -> work_units.client_id, since neither table has a client_id
column of its own, with the app.system_bypass clause baked in from the
start (68c3926e1143's convention for every table created after it).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7d35a1c2c7b'
down_revision: Union[str, Sequence[str], None] = '55df2bc65a11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"

_METHOD_ENUM = sa.Enum(
    'document_check', 'system_of_record', 'second_person', 'sample', 'reconcile',
    'model_plus_human', 'none', name='verificationdesignmethod',
)
_INDEPENDENCE_ENUM = sa.Enum('different_lineage', 'deterministic', 'no', 'not_stated', name='independencekind')
_CERTIFICATION_ENUM = sa.Enum(
    'sure', 'mostly_sure', 'reported_not_seen', 'cannot_define', name='certificationclass',
)


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY tenant_isolation ON {table} FOR ALL "
        f"USING (work_unit_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (work_unit_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS})"
    )


def upgrade() -> None:
    op.create_table(
        'verification_designs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_unit_id', sa.Integer(), nullable=False),
        sa.Column('method', _METHOD_ENUM, nullable=False),
        sa.Column('independent', _INDEPENDENCE_ENUM, nullable=False),
        sa.Column('sampling', sa.Text(), nullable=True),
        sa.Column('cost_of_check', sa.Text(), nullable=True),
        sa.Column('dual_track', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['work_unit_id'], ['work_units.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('work_unit_id', name='uq_verification_designs_work_unit'),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON verification_designs TO wep_app")
    op.execute("GRANT USAGE, SELECT ON verification_designs_id_seq TO wep_app")
    _rls('verification_designs')

    op.create_table(
        'certifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_unit_id', sa.Integer(), nullable=False),
        sa.Column('class', _CERTIFICATION_ENUM, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['work_unit_id'], ['work_units.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('work_unit_id', name='uq_certifications_work_unit'),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON certifications TO wep_app")
    op.execute("GRANT USAGE, SELECT ON certifications_id_seq TO wep_app")
    _rls('certifications')


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON certifications")
    op.execute("ALTER TABLE certifications NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE certifications DISABLE ROW LEVEL SECURITY")
    op.drop_table('certifications')

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON verification_designs")
    op.execute("ALTER TABLE verification_designs NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE verification_designs DISABLE ROW LEVEL SECURITY")
    op.drop_table('verification_designs')

    op.execute("DROP TYPE IF EXISTS certificationclass")
    op.execute("DROP TYPE IF EXISTS independencekind")
    op.execute("DROP TYPE IF EXISTS verificationdesignmethod")
