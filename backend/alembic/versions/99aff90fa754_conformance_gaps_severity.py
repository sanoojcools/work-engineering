"""conformance_gaps.severity for Gate 10

Revision ID: 99aff90fa754
Revises: efc855b7d06a
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99aff90fa754'
down_revision: Union[str, Sequence[str], None] = 'efc855b7d06a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'conformance_gaps',
        sa.Column('severity', sa.String(length=4), nullable=False, server_default='P2'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('conformance_gaps', 'severity')
