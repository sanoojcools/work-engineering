"""create non-superuser wep_app role for RLS enforcement

Revision ID: f198c4aadd2c
Revises: 9a07306c5434
Create Date: 2026-08-25 18:40:03.920376

Postgres superusers bypass Row Level Security unconditionally — FORCE ROW
LEVEL SECURITY only strips the *table owner* exemption, not the superuser
one. `wep` is the cluster's bootstrap role (created via POSTGRES_USER in
the official postgres image) and is a superuser, so the RLS policies added
in 9a07306c5434 are invisible to any connection using it. The app's
runtime connection (app/config.py settings.database_url) must use this
restricted role for tenant isolation to mean anything; `wep` stays for
Alembic/migrations only.

Dev password below matches this repo's existing wep/wep convention for
local dev — override via DATABASE_URL env var (see .env.example) for any
non-local environment, same as the existing wep user.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f198c4aadd2c'
down_revision: Union[str, Sequence[str], None] = '9a07306c5434'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wep_app') THEN "
        "CREATE ROLE wep_app LOGIN PASSWORD 'wep_app_dev_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; "
        "END IF; "
        "END $$;"
    )
    op.execute("GRANT CONNECT ON DATABASE wep TO wep_app")
    op.execute("GRANT USAGE ON SCHEMA public TO wep_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO wep_app")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wep_app")
    # Future tables created by `wep` (via later migrations) grant to wep_app automatically.
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE wep IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wep_app"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE wep IN SCHEMA public "
        "GRANT USAGE, SELECT ON SEQUENCES TO wep_app"
    )


def downgrade() -> None:
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM wep_app")
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM wep_app")
    op.execute("REVOKE USAGE ON SCHEMA public FROM wep_app")
    op.execute("REVOKE CONNECT ON DATABASE wep FROM wep_app")
    op.execute("DROP ROLE IF EXISTS wep_app")
