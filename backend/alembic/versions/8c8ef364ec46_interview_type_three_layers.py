"""interview type three layers

Revision ID: 8c8ef364ec46
Revises: 2460d638860e
Create Date: 2026-09-01 10:36:26.088567

ScoutInterviewSession.type grows from two organizational altitudes to
three: founder -> function_head (unchanged meaning, renamed to match the
enterprise persona the product actually targets -- a CHRO, not a startup
founder) plus a new middle tier, sub_function_lead (e.g. Head of TA, Head
of People Ops), between it and the existing sme tier.

A value RENAME rather than a new column: every existing row's meaning is
preserved automatically (Postgres updates the stored label in place), no
data migration/backfill needed, and application code keeps one `type`
column rather than growing a parallel "new_type" one during a transition.
ADD VALUE for the new middle tier is additive and cannot be undone in the
same simple way -- see downgrade().
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c8ef364ec46'
down_revision: Union[str, Sequence[str], None] = '2460d638860e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE interviewtype RENAME VALUE 'founder' TO 'function_head'")
    op.execute("ALTER TYPE interviewtype ADD VALUE IF NOT EXISTS 'sub_function_lead' AFTER 'function_head'")


def downgrade() -> None:
    """Downgrade schema.

    Reverses the rename. Does NOT remove 'sub_function_lead' -- Postgres
    has no ALTER TYPE ... DROP VALUE; removing it cleanly would mean
    rebuilding the enum type and reassigning any row already using that
    value first. Not attempted here, since nothing in this project's
    history has needed a downgrade path run for real; if one ever is,
    do the type-rebuild then, against real data, rather than speculative
    machinery now.
    """
    op.execute("ALTER TYPE interviewtype RENAME VALUE 'function_head' TO 'founder'")
