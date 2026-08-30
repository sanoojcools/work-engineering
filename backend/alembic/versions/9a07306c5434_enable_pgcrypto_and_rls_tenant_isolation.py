"""enable pgcrypto and RLS tenant isolation

Revision ID: 9a07306c5434
Revises: b60fef9c9a01
Create Date: 2026-08-25 18:37:21.406432

Tenant boundary is the existing clients.id (see models/security.py for why
this doesn't introduce a parallel orgs table). Session variable is
app.current_client_id, set per-request via SET LOCAL by the auth dependency
in app/dependencies.py so it never leaks across pooled connections.

Fail-closed by design: NULLIF(...) makes an unset session variable compare
as NULL, and `client_id = NULL` is never true in Postgres — so a request
that never set the session variable sees zero rows, not every tenant's rows.

FORCE ROW LEVEL SECURITY is required because the `wep` role owns these
tables; without it Postgres would exempt the table owner from its own
policies, defeating the point of the tenant_isolation test in the ambitious
spec (two orgs, two API keys, org B must get zero rows for org A's data).
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '9a07306c5434'
down_revision: Union[str, Sequence[str], None] = 'b60fef9c9a01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables with a direct client_id column.
#
# org_api_keys is deliberately NOT in this list: resolving which tenant a
# presented X-Spec-Key belongs to requires scanning key_hash across ALL
# tenants BEFORE app.current_client_id is known (RLS on this table would
# make that lookup impossible — chicken-and-egg). It's protected the way
# any credential table is: key_hash is a sha256 of a high-entropy secret,
# so a lookup can only succeed by presenting the real key, and the app
# never lists other tenants' keys back to a caller.
DIRECT_TABLES = [
    "work_units",
    "intent_sources",
    "discovery_candidates",
    "conformance_gaps",
    "consent_receipts",
    "genome_versions",
    "uploaded_files",
    "review_queue",
]

# Tables scoped to a tenant only via work_unit_id -> work_units.client_id.
WORK_UNIT_CHILD_TABLES = [
    "work_unit_provenance",
    "work_unit_regulatory_links",
    "pii_field_values",
    "verdict_scores",
    "cost_profiles",
    "verification_runs",
    "autonomy_changes",
    "spec_checks",
    "trajectories",
    "work_unit_variants",
]

CURRENT_CLIENT = "NULLIF(current_setting('app.current_client_id', true), '')::integer"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    for table in DIRECT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} FOR ALL "
            f"USING (client_id = {CURRENT_CLIENT}) "
            f"WITH CHECK (client_id = {CURRENT_CLIENT})"
        )

    for table in WORK_UNIT_CHILD_TABLES:
        # work_unit_variants stores the FK as parent_id, everything else as work_unit_id.
        fk_col = "parent_id" if table == "work_unit_variants" else "work_unit_id"
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} FOR ALL "
            f"USING ({fk_col} IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT})) "
            f"WITH CHECK ({fk_col} IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}))"
        )

    # work_edges references two work_units (source_id, target_id) — an edge
    # between two tenants' units should never exist, but both sides are
    # checked for defense in depth.
    op.execute("ALTER TABLE work_edges ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE work_edges FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON work_edges FOR ALL "
        f"USING (source_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) "
        f"AND target_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT})) "
        f"WITH CHECK (source_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}) "
        f"AND target_id IN (SELECT id FROM work_units WHERE client_id = {CURRENT_CLIENT}))"
    )

    # audit_logs.client_id is nullable (some actions predate tenant
    # resolution, e.g. a rejected auth attempt) — rows with client_id IS
    # NULL are never visible under RLS even to the actor who caused them;
    # that's acceptable since audit reads always happen in a resolved-tenant
    # request context, and cross-tenant audit visibility is exactly what
    # this policy exists to prevent.
    op.execute("ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON audit_logs FOR ALL "
        f"USING (client_id = {CURRENT_CLIENT}) "
        f"WITH CHECK (client_id = {CURRENT_CLIENT} OR client_id IS NULL)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON audit_logs")
    op.execute("ALTER TABLE audit_logs NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON work_edges")
    op.execute("ALTER TABLE work_edges NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE work_edges DISABLE ROW LEVEL SECURITY")

    for table in WORK_UNIT_CHILD_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    for table in DIRECT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
