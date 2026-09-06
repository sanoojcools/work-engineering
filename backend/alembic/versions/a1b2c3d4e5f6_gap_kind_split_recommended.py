"""conformance_gaps.kind gains split_recommended (Gate 6)

Revision ID: a1b2c3d4e5f6
Revises: 99aff90fa754
Create Date: 2026-09-06 00:00:00.000000

Track 1 slice 1.2 (docs/BUILD_PROGRAM.md, Gate 6 per
docs/ROADMAP-DECISIONS.md): genome_import.py reuses the existing
ConformanceGap table for the new advisory "this Work Unit looks like it
should be split" warning rather than inventing a second table, so the
gapkind Postgres enum needs the new value. Purely additive -- see
8c8ef364ec46's downgrade() note on why Postgres enum values are not
dropped on downgrade.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '99aff90fa754'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE gapkind ADD VALUE IF NOT EXISTS 'split_recommended'")


def downgrade() -> None:
    """Downgrade schema.

    Does NOT remove 'split_recommended' -- Postgres has no ALTER TYPE ...
    DROP VALUE; removing it cleanly would mean rebuilding the enum type and
    reassigning any row already using that value first. Not attempted here,
    same reasoning as 8c8ef364ec46's downgrade().
    """
    pass
