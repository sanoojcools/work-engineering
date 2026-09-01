"""scout blast radius selections

Revision ID: a0a1d4aecaf3
Revises: 8c8ef364ec46
Create Date: 2026-09-01 10:46:27.480531

Scout Elevated upgrade thread, Point 2. The 44-sub-function HR catalog
itself (services/scout_blast_radius.py) is a published constant, not a
table -- this table holds only which sub-functions a tenant's CHRO has
actually touched (in scope, owner assigned, or priority set). Same direct
client_id + tenant_isolation RLS policy shape as scout_interview_sessions
(b8469d3e03ae).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a0a1d4aecaf3'
down_revision: Union[str, Sequence[str], None] = '8c8ef364ec46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'scout_blast_radius_selections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('sub_function_key', sa.String(length=80), nullable=False),
        sa.Column('in_scope', sa.Boolean(), nullable=False),
        sa.Column('owner_name', sa.String(length=160), nullable=False),
        sa.Column('priority', sa.String(length=4), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', 'sub_function_key', name='uq_blast_radius_client_subfn'),
    )
    op.create_index('ix_blast_radius_client', 'scout_blast_radius_selections', ['client_id'], unique=False)

    current_client = "NULLIF(current_setting('app.current_client_id', true), '')::integer"

    op.execute("ALTER TABLE scout_blast_radius_selections ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE scout_blast_radius_selections FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON scout_blast_radius_selections FOR ALL "
        f"USING (client_id = {current_client}) "
        f"WITH CHECK (client_id = {current_client})"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON scout_blast_radius_selections")
    op.execute("ALTER TABLE scout_blast_radius_selections NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE scout_blast_radius_selections DISABLE ROW LEVEL SECURITY")

    op.drop_index('ix_blast_radius_client', table_name='scout_blast_radius_selections')
    op.drop_table('scout_blast_radius_selections')
