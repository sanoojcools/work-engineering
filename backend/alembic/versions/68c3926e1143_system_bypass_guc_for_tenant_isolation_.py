"""system bypass GUC for tenant_isolation RLS policies

Revision ID: 68c3926e1143
Revises: a0a1d4aecaf3
Create Date: 2026-09-05 17:47:31.708214

Fixes a real 500 on the hosted pitch instance: POST /api/demo/bootstrap ->
psycopg2.errors.InsufficientPrivilege: new row violates row-level security
policy for table "work_units" (confirmed via Render's own log API, commit
f219980, 2026-09-05 17:19 UTC).

Root cause, confirmed by querying pg_roles on the live Render Postgres:
the managed database's owning role ("wep") has rolsuper=false AND
rolbypassrls=false. Every managed Postgres provider withholds both from the
app-facing owner role for security -- this is not Render-specific.

9a07306c5434 (the original RLS migration) put FORCE ROW LEVEL SECURITY on
every tenant table specifically because `wep` owns them, and an owner is
normally exempt from its own table's RLS policies -- that FORCE is what
makes the tenant_isolation test meaningful. But admin.py's demo/bootstrap,
demo/prepare, and admin/consent/purge endpoints were *always* designed to
run on SystemDbDep (SYSTEM_DATABASE_URL) specifically because that
connection was assumed to bypass RLS as a superuser -- see db.py's own
"Bypasses RLS by connecting as the migration superuser" comment. Those two
assumptions only coexisted safely in local dev/CI because docker-compose's
`wep` happens to ALSO be a genuine Postgres superuser (bootstrapped by the
stock postgres:16-alpine image), which bypasses FORCE ROW LEVEL SECURITY
unconditionally. No managed Postgres grants that, so the conflict was
always latent and was never going to survive first contact with a real
host.

Fix: an explicit, portable session flag (`app.system_bypass`) that
get_system_db() sets on every system session, ORed into every existing
`tenant_isolation` policy's USING/WITH CHECK clause. This works identically
whether the underlying role is a true superuser (local dev, harmless no-op
alongside the already-unconditional superuser bypass) or a constrained
managed-Postgres owner (Render, RDS, Supabase, ...). Ordinary per-request
sessions (get_db()/DbDep/TenantDbDep) never set this GUC and remain exactly
as tenant-isolated as before.

Introspects pg_policies for every policy literally named `tenant_isolation`
and ALTERs it in place, rather than hand-maintaining a table list: by the
time this migration was written, four tables added by *later* migrations
(scout_interview_sessions, scout_captured_units, scout_blast_radius_
selections, scout_contradictions) plus `ratifications` already carried
their own tenant_isolation policy that 9a07306c5434's own hardcoded list
never mentioned -- proof that a hand-maintained list drifts. Verified for
real: dropped Render's role attributes onto a fresh local Postgres 16
(rolsuper=false, rolbypassrls=false, matching a live `SELECT rolsuper,
rolbypassrls FROM pg_roles WHERE rolname='wep'` against Render), and the
full backend suite (165 tests, including every RLS/isolation test) passed
clean before this migration existed only because local `wep` really is a
superuser -- and failed with exactly the reported traceback, then passed
again once this migration and db.py's GUC were both in place.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68c3926e1143'
down_revision: Union[str, Sequence[str], None] = 'a0a1d4aecaf3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SYSTEM_BYPASS = "current_setting('app.system_bypass', true) = 'on'"
# Exact suffix this migration appends, so downgrade can strip it back off by
# string identity rather than re-deriving each policy's original expression.
_APPENDED = f" OR {SYSTEM_BYPASS}"


def _tenant_isolation_policies(conn):
    return conn.execute(sa.text(
        "SELECT schemaname, tablename, qual, with_check FROM pg_policies "
        "WHERE policyname = 'tenant_isolation' ORDER BY tablename"
    )).fetchall()


def upgrade() -> None:
    conn = op.get_bind()
    rows = _tenant_isolation_policies(conn)
    if not rows:
        raise RuntimeError(
            "No policy named 'tenant_isolation' found — expected at least the "
            "tables 9a07306c5434 created. Refusing to no-op silently."
        )
    for schema, table, qual, with_check in rows:
        qual = qual or "true"
        with_check = with_check or qual
        conn.execute(sa.text(
            f'ALTER POLICY tenant_isolation ON "{schema}"."{table}" '
            f"USING (({qual}){_APPENDED}) WITH CHECK (({with_check}){_APPENDED})"
        ))


def downgrade() -> None:
    conn = op.get_bind()
    rows = _tenant_isolation_policies(conn)
    for schema, table, qual, with_check in rows:
        if qual and qual.rstrip().endswith(_APPENDED.strip()):
            qual = qual[: -len(_APPENDED)].strip()
            if qual.startswith("(") and qual.endswith(")"):
                qual = qual[1:-1]
        if with_check and with_check.rstrip().endswith(_APPENDED.strip()):
            with_check = with_check[: -len(_APPENDED)].strip()
            if with_check.startswith("(") and with_check.endswith(")"):
                with_check = with_check[1:-1]
        conn.execute(sa.text(
            f'ALTER POLICY tenant_isolation ON "{schema}"."{table}" '
            f"USING ({qual}) WITH CHECK ({with_check})"
        ))
