"""conformance_gaps.kind gains broken_pointer

Revision ID: 83b0d367912a
Revises: afca8777b3bd
Create Date: 2026-09-07 19:25:21.791691

V10-2 (docs/V10_BUILD.md): services/pointers.py reuses the existing
ConformanceGap table for a field pointer that claimed observed/reconstructed
but could not be opened, rather than inventing a second gap table -- so the
gapkind Postgres enum needs the new value. Purely additive -- see
8c8ef364ec46's downgrade() note on why Postgres enum values are not dropped
on downgrade (same reasoning a1b2c3d4e5f6 / b2c3d4e5f6a7 already state).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '83b0d367912a'
down_revision: Union[str, Sequence[str], None] = 'afca8777b3bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE gapkind ADD VALUE IF NOT EXISTS 'broken_pointer'")


def downgrade() -> None:
    """Does NOT remove 'broken_pointer' -- Postgres has no ALTER TYPE ...
    DROP VALUE; removing it cleanly would mean rebuilding the enum type and
    reassigning any row already using that value first. Not attempted here,
    same reasoning as 8c8ef364ec46's downgrade()."""
    pass
