"""clients.fabrication_count for V10-2

Revision ID: 55df2bc65a11
Revises: 83b0d367912a
Create Date: 2026-09-07 19:25:22.233735

V10-2 (docs/V10_BUILD.md): "not a 12-metric dashboard" -- one counter per
tenant, incremented by services/pointers.py whenever a field pointer
claiming observed/reconstructed fails to resolve. NOT NULL with a server
default of 0 so the backfill for existing rows is unconditional.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '55df2bc65a11'
down_revision: Union[str, Sequence[str], None] = '83b0d367912a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'clients',
        sa.Column('fabrication_count', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('clients', 'fabrication_count')
