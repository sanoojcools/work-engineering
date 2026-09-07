"""field_pointers table V10-2

Revision ID: afca8777b3bd
Revises: c1e81ae18515
Create Date: 2026-09-07 19:25:21.480715

V10-2 (docs/V10_BUILD.md): one row per (work_unit, field_name) evidence
pointer -- file_id + page/line/cell, one of five statuses, and the quote a
binding field's resolver verified. Additive alongside the existing 1:1
work_unit_provenance (models/security.py::WorkUnitProvenanceDetail), not a
replacement -- see models/pointers.py's module docstring for why this is a
new table rather than a change to that one.

Same RLS shape as the WORK_UNIT_CHILD_TABLES family from 9a07306c5434 (FK
through work_unit_id -> work_units.client_id, since this table itself has
no client_id column), with the app.system_bypass clause baked in from the
start -- same convention c1e81ae18515 (censuses) and 549fc2e9287a
(work_systems) already follow for tables created after 68c3926e1143.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'afca8777b3bd'
down_revision: Union[str, Sequence[str], None] = 'c1e81ae18515'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"

_STATUS_ENUM = sa.Enum(
    'observed', 'declared', 'reconstructed', 'composed', 'predicted', name='pointerstatus',
)


def upgrade() -> None:
    op.create_table(
        'field_pointers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_unit_id', sa.Integer(), nullable=False),
        sa.Column('field_name', sa.String(length=60), nullable=False),
        sa.Column('requested_status', _STATUS_ENUM, nullable=False),
        sa.Column('status', _STATUS_ENUM, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=True),
        sa.Column('page', sa.Integer(), nullable=True),
        sa.Column('line', sa.Integer(), nullable=True),
        sa.Column('cell', sa.String(length=40), nullable=True),
        sa.Column('quote', sa.Text(), nullable=False),
        sa.Column('resolved', sa.Boolean(), nullable=False),
        sa.Column('resolution_note', sa.Text(), nullable=False),
        sa.Column('gap_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['work_unit_id'], ['work_units.id']),
        sa.ForeignKeyConstraint(['file_id'], ['uploaded_files.id']),
        sa.ForeignKeyConstraint(['gap_id'], ['conformance_gaps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('work_unit_id', 'field_name', name='uq_field_pointers_unit_field'),
    )
    op.create_index('ix_field_pointers_work_unit', 'field_pointers', ['work_unit_id'], unique=False)
    op.create_index('ix_field_pointers_file', 'field_pointers', ['file_id'], unique=False)

    # wep_app's default privileges (f198c4aadd2c) already cover future
    # tables created by wep -- explicit anyway, matching every other table
    # created since (censuses, work_systems, ...).
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON field_pointers TO wep_app")
    op.execute("GRANT USAGE, SELECT ON field_pointers_id_seq TO wep_app")

    op.execute("ALTER TABLE field_pointers ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE field_pointers FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON field_pointers FOR ALL "
        f"USING (work_unit_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (work_unit_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON field_pointers")
    op.execute("ALTER TABLE field_pointers NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE field_pointers DISABLE ROW LEVEL SECURITY")

    op.drop_index('ix_field_pointers_file', table_name='field_pointers')
    op.drop_index('ix_field_pointers_work_unit', table_name='field_pointers')
    op.drop_table('field_pointers')
    op.execute("DROP TYPE IF EXISTS pointerstatus")
