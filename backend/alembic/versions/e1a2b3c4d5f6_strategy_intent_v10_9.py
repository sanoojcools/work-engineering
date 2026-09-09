"""strategy intent columns on work_systems (V10-9)

Revision ID: e1a2b3c4d5f6
Revises: 3414223b50be
Create Date: 2026-09-09 00:00:00.000000

Third and last intent level on the one existing Work System row
(docs/V10_BUILD.md "V10-9 STRATEGY INTENT -- one line, not a studio"),
same additive-columns shape ac2a876395e4 already used for Function and
Work System intent -- not a new table, not INT-007
(docs/INTENT_CONTRACT.md's refusal still holds). `focus` is the period's
one-line focus sentence; `owner` is a named human or an explicit stand-in
until a real sponsor exists. *_confirmed_by / *_confirmed_at stay null
(draft) until a keyed "Confirm as owner" click sets both together, same
draft-vs-confirmed-is-derived-from-confirmed_at rule the other two
intents already follow.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a2b3c4d5f6'
down_revision: Union[str, Sequence[str], None] = '3414223b50be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('work_systems', sa.Column('strategy_intent_focus', sa.Text(), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('strategy_intent_owner', sa.String(length=160), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('strategy_intent_confirmed_by', sa.String(length=120), nullable=False, server_default=''))
    op.add_column('work_systems', sa.Column('strategy_intent_confirmed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('work_systems', 'strategy_intent_confirmed_at')
    op.drop_column('work_systems', 'strategy_intent_confirmed_by')
    op.drop_column('work_systems', 'strategy_intent_owner')
    op.drop_column('work_systems', 'strategy_intent_focus')
