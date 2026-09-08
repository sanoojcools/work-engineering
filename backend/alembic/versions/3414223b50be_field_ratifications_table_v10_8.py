"""field_ratifications table (V10-8 field ratify + decision cards)

Revision ID: 3414223b50be
Revises: d4e5f6a7b8c9
Create Date: 2026-09-08 00:00:00.000000

Same RLS shape as work_systems (549fc2e9287a): direct client_id + a
tenant_isolation policy with the app.system_bypass clause baked in from the
start, not bolted on later.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3414223b50be'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"
SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"


def upgrade() -> None:
    op.create_table(
        'field_ratifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('work_unit_id', sa.Integer(), nullable=False),
        sa.Column(
            'field_name',
            sa.Enum('desired_condition', 'authority', 'acceptance_criteria', name='fieldratificationfield'),
            nullable=False,
        ),
        sa.Column('sitting_quote', sa.Text(), nullable=False),
        sa.Column('drafted_value', sa.Text(), nullable=False),
        sa.Column('confirmed_value', sa.Text(), nullable=True),
        sa.Column(
            'status',
            sa.Enum('drafted', 'confirmed', 'corrected', name='fieldratificationstatus'),
            nullable=False,
        ),
        sa.Column('confirmed_by', sa.String(length=120), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['work_unit_id'], ['work_units.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'client_id', 'work_unit_id', 'field_name', name='uq_field_ratifications_client_unit_field',
        ),
    )
    op.create_index('ix_field_ratifications_client', 'field_ratifications', ['client_id'], unique=False)
    op.create_index('ix_field_ratifications_work_unit', 'field_ratifications', ['work_unit_id'], unique=False)

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON field_ratifications TO wep_app")
    op.execute("GRANT USAGE, SELECT ON field_ratifications_id_seq TO wep_app")

    op.execute("ALTER TABLE field_ratifications ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE field_ratifications FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON field_ratifications FOR ALL "
        f"USING (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS}) "
        f"WITH CHECK (client_id = {CURRENT_CLIENT} OR {SYSTEM_BYPASS})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON field_ratifications")
    op.execute("ALTER TABLE field_ratifications NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE field_ratifications DISABLE ROW LEVEL SECURITY")

    op.drop_index('ix_field_ratifications_work_unit', table_name='field_ratifications')
    op.drop_index('ix_field_ratifications_client', table_name='field_ratifications')
    op.drop_table('field_ratifications')
    op.execute("DROP TYPE IF EXISTS fieldratificationstatus")
    op.execute("DROP TYPE IF EXISTS fieldratificationfield")
