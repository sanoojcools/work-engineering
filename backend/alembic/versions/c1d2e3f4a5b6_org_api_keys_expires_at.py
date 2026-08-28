"""org_api_keys.expires_at for rotation grace window

Revision ID: c1d2e3f4a5b6
Revises: 8ba56adb6720
Create Date: 2026-08-28 00:00:00.000000

Slice 3 PR 3a (playbook G.1): POST /org/keys/rotate marks the previous key
is_active=False and sets expires_at = now + ROTATION_GRACE_MINUTES so a
caller mid-flight doesn't get cut off mid-rotation. require_org_api_key
treats a key as valid while is_active OR expires_at is still in the future;
once expires_at passes, the row 401s like any other dead key. org_api_keys
carries no RLS policy (see 9a07306c5434's comment on this table), so this
column needs no policy change.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = '8ba56adb6720'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "org_api_keys",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("org_api_keys", "expires_at")
