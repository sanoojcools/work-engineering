"""conformance_gaps.kind gains missing_terminal_state (Gate 9)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-06 00:00:00.000000

Track 1 slice 1.3 (docs/BUILD_PROGRAM.md, Gate 9 per
docs/ROADMAP-DECISIONS.md): genome_import.py reuses the existing
ConformanceGap table for the new advisory "this business object's inferred
state graph never closes" warning rather than inventing a second table, so
the gapkind Postgres enum needs the new value. Purely additive -- same
shape as a1b2c3d4e5f6 (Gate 6's split_recommended) -- see that migration's
downgrade() note on why Postgres enum values are not dropped on downgrade.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE gapkind ADD VALUE IF NOT EXISTS 'missing_terminal_state'")


def downgrade() -> None:
    """Downgrade schema.

    Does NOT remove 'missing_terminal_state' -- Postgres has no ALTER TYPE
    ... DROP VALUE; removing it cleanly would mean rebuilding the enum type
    and reassigning any row already using that value first. Not attempted
    here, same reasoning as a1b2c3d4e5f6's downgrade().
    """
    pass
