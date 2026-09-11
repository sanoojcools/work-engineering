"""clients delinquency counters for V10-12

Revision ID: f1a2b3c4d5e6
Revises: e1a2b3c4d5f6
Create Date: 2026-09-11 00:00:00.000000

V10-12 (docs/contracts/v10-12-discovery.md): four delinquency counters --
invention, omission, distortion, flattery -- bumped by
services/scout_story.py's scoring pass on POST /api/scout/extract-from-story
(commit=true or used_llm=true). Same "not a 12-metric dashboard" restraint
as clients.fabrication_count (55df2bc65a11): plain columns, no new table.
NOT NULL with a server default of 0 so the backfill for existing rows is
unconditional.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e1a2b3c4d5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for col in ("invention_count", "omission_count", "distortion_count", "flattery_count"):
        op.add_column('clients', sa.Column(col, sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    for col in ("flattery_count", "distortion_count", "omission_count", "invention_count"):
        op.drop_column('clients', col)
