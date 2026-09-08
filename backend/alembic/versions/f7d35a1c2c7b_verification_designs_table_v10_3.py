"""verification_designs table V10-3

Revision ID: f7d35a1c2c7b
Revises: 55df2bc65a11
Create Date: 2026-09-08 00:00:00.000000

V10-3 (docs/V10_BUILD.md, docs/BUILD_PROGRAM.md): one row per Work Unit
holding its verification design (method/independence/sampling/cost) and
certification -- see models/verification_design.py's module docstring for
why this is a new table rather than a change to models/verification.py's
VerificationRun or models/ontology.py's Provenance.

Same RLS shape as field_pointers (afca8777b3bd, V10-2): FK through
work_unit_id -> work_units.client_id, since this table has no client_id
column of its own, with the app.system_bypass clause baked in from the
start (68c3926e1143's convention for every table created after it).

`method` reuses the existing `verificationmethod` Postgres enum type
(created by the baseline migration for work_units.verification_method).
The generic `sa.Enum(..., create_type=False)` spelling the rest of this
repo's migrations use for a same-file reuse does not suppress `CREATE TYPE`
when the type was created by an *earlier, separate* migration (verified
against this table: it still raised DuplicateObject) -- the dialect-
specific `postgresql.ENUM(..., create_type=False)` is what actually
implements the flag (see its own docstring), so that is used here instead.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM


# revision identifiers, used by Alembic.
revision: str = 'f7d35a1c2c7b'
down_revision: Union[str, Sequence[str], None] = '55df2bc65a11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"

_METHOD_ENUM = PG_ENUM(
    'deterministic_rule', 'database_constraint', 'cross_system_reconciliation', 'human_spot_check',
    'llm_as_judge', 'outcome_delay', 'counterparty_confirmation', name='verificationmethod', create_type=False,
)
_INDEPENDENCE_ENUM = sa.Enum('different_lineage', 'deterministic', 'no', name='independencekind')
_CERTIFICATION_ENUM = sa.Enum(
    'sure', 'mostly_sure', 'reported_not_seen', 'cannot_define', name='certificationclass',
)
_ERROR_COST_ENUM = sa.Enum('contestable', 'irreversible', name='errorcost')


def upgrade() -> None:
    op.create_table(
        'verification_designs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_unit_id', sa.Integer(), nullable=False),
        sa.Column('method', _METHOD_ENUM, nullable=True),
        sa.Column('independence', _INDEPENDENCE_ENUM, nullable=False),
        sa.Column('independence_required', sa.Boolean(), nullable=False),
        sa.Column('sampling', sa.Text(), nullable=False),
        sa.Column('cost', sa.Float(), nullable=True),
        sa.Column('error_cost', _ERROR_COST_ENUM, nullable=False),
        sa.Column('certification', _CERTIFICATION_ENUM, nullable=False),
        sa.Column('checked_by', sa.String(length=120), nullable=False),
        sa.Column('dual_track', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['work_unit_id'], ['work_units.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('work_unit_id', name='uq_verification_designs_work_unit'),
    )

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON verification_designs TO wep_app")
    op.execute("GRANT USAGE, SELECT ON verification_designs_id_seq TO wep_app")

    op.execute("ALTER TABLE verification_designs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE verification_designs FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON verification_designs FOR ALL "
        f"USING (work_unit_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (work_unit_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON verification_designs")
    op.execute("ALTER TABLE verification_designs NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE verification_designs DISABLE ROW LEVEL SECURITY")

    op.drop_table('verification_designs')
    op.execute("DROP TYPE IF EXISTS independencekind")
    op.execute("DROP TYPE IF EXISTS certificationclass")
    op.execute("DROP TYPE IF EXISTS errorcost")
