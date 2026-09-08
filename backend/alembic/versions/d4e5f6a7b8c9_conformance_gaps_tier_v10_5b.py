"""conformance_gaps.tier (V10-5b three gap tiers)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-08 00:00:00.000000

V10-5b (docs/NEXT.md): "Reuse `conformance_gaps`. Additive column `tier`
(default `process`)." NOT NULL with server_default 'process' rather than a
nullable column: every gap that already exists is a Tier 1 process gap
(docs/V10_BUILD.md V10-5), so there is no honest "tier unknown" state to
model -- unlike, say, outcome_records.measured, where null means something
real ("nobody has measured this") and is preserved as such.

Unlike conformance_gaps.severity (99aff90fa754), which is a plain string so
future manual triage isn't blocked on a migration, tier is a real Postgres
enum: the three tiers are canon and closed, and a fourth would be a change
to the canon, not a triage call. See models/discovery.py::GapTier.

No new GRANT or RLS statement is needed: conformance_gaps already carries
both from the baseline (b60fef9c9a01) and 9a07306c5434's tenant_isolation
policy, and adding a column to a table under FORCE ROW LEVEL SECURITY does
not change either -- the policy is on client_id, which is untouched here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Name matches what SQLAlchemy derives from models/discovery.py::GapTier
# (class name, lowercased) -- if these two ever disagree, `alembic check`
# in CI reports the drift as a spurious add_column.
_TIER_ENUM = sa.Enum('process', 'journey', 'outcome', name='gaptier')


def upgrade() -> None:
    """Upgrade schema."""
    _TIER_ENUM.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'conformance_gaps',
        sa.Column('tier', _TIER_ENUM, nullable=False, server_default='process'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('conformance_gaps', 'tier')
    _TIER_ENUM.drop(op.get_bind(), checkfirst=True)
