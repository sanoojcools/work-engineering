"""conformance_gaps.kind gains missing_handoff + outcome_not_measured (V10-5b)

Revision ID: c3d4e5f6a7b8
Revises: 0b996f6d42b7
Create Date: 2026-09-08 00:00:00.000000

V10-5b (docs/NEXT.md, docs/V10_BUILD.md V10-5 "Gap 3 tiers"): the journey
and outcome tiers reuse the existing ConformanceGap table rather than
inventing two more warnings tables -- the same call a1b2c3d4e5f6 (Gate 6)
and b2c3d4e5f6a7 (Gate 9) already made -- so the gapkind Postgres enum
needs the two new values. Purely additive; kept in its own revision,
separate from the `tier` column (d4e5f6a7b8c9), because a Postgres enum
value added inside a transaction cannot be used by later statements in
that same transaction.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = '0b996f6d42b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE gapkind ADD VALUE IF NOT EXISTS 'missing_handoff'")
    op.execute("ALTER TYPE gapkind ADD VALUE IF NOT EXISTS 'outcome_not_measured'")


def downgrade() -> None:
    """Downgrade schema.

    Does NOT remove the two values -- Postgres has no ALTER TYPE ... DROP
    VALUE, and removing them cleanly would mean rebuilding the enum type and
    reassigning any row already using them first. Not attempted here, same
    reasoning as a1b2c3d4e5f6 / b2c3d4e5f6a7.
    """
    pass
