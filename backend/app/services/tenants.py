"""Company boundary: Catalog (test lab) and Client A (HR census clone)."""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from ..models.client import Client
from ..models.workunit import WorkUnit

CATALOG_SLUG = "catalog"
CLIENT_A_SLUG = "client-a"
HR_CLONE_PREFIXES = ("WU-ONB", "WU-OFF")
INDUSTRY_TAGS = ("-BFSI-", "-MFG-", "-HLTH-", "-RETAIL-", "-ITES-")

FUNCTION_PREFIXES: dict[str, tuple[str, ...]] = {
    "HR & People Ops": ("WU-HR", "WU-ONB", "WU-OFF"),
    "Finance & Compliance": ("WU-FIN",),
    "Sales & O2C": ("WU-OTC", "WU-SALES"),
    "Customer Service": ("WU-CS",),
    "Tech / Product": ("WU-TECH",),
    "Ops / Supply Chain": ("WU-OPS",),
}

CLONE_FIELDS = (
    "code", "name", "business_object_type_id", "current_condition", "desired_condition",
    "context", "trigger", "inputs", "authority", "actor_constraints", "acceptance_criteria",
    "evidence_required", "verification_method", "sla_hours", "failure_semantics",
    "regulatory_entry_id", "provenance", "owner", "actor_type", "status",
    "autonomy_level", "is_sustaining",
)


def is_cross_industry_hr(code: str) -> bool:
    if any(tag in code for tag in INDUSTRY_TAGS):
        return False
    return code.startswith("WU-ONB") or code.startswith("WU-OFF")


def function_of(code: str) -> str:
    for name, prefixes in FUNCTION_PREFIXES.items():
        if any(code.startswith(p) for p in prefixes):
            return name
    return "Other"


def units_query(db: Session, client_id: int | None = None):
    q = db.query(WorkUnit)
    if client_id is not None:
        q = q.filter(WorkUnit.client_id == client_id)
    return q.order_by(WorkUnit.id)


def units_for_function(units: list[WorkUnit], function: str) -> list[WorkUnit]:
    prefixes = FUNCTION_PREFIXES.get(function)
    if not prefixes:
        return [u for u in units if function_of(u.code) == function]
    return [u for u in units if any(u.code.startswith(p) for p in prefixes)]


def ensure_schema(engine) -> None:
    """Add client_id on existing Postgres/SQLite DBs created before this slice."""
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    if "work_units" not in tables:
        return
    dialect = engine.dialect.name
    with engine.begin() as conn:
        _add_column(conn, insp, dialect, "work_units", "client_id", "INTEGER")
        if "intent_sources" in tables:
            _add_column(conn, insp, dialect, "intent_sources", "client_id", "INTEGER")
        if "discovery_candidates" in tables:
            _add_column(conn, insp, dialect, "discovery_candidates", "client_id", "INTEGER")
        if "conformance_gaps" in tables:
            _add_column(conn, insp, dialect, "conformance_gaps", "client_id", "INTEGER")
        if dialect == "postgresql":
            conn.execute(text("ALTER TABLE work_units DROP CONSTRAINT IF EXISTS work_units_code_key"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_work_units_client_code "
                "ON work_units (client_id, code)"
            ))
        if "verdict_scores" in tables:
            _add_column(conn, insp, dialect, "verdict_scores", "origin", "VARCHAR(20) DEFAULT 'confirmed'")
        if "cost_profiles" in tables:
            _add_column(conn, insp, dialect, "cost_profiles", "origin", "VARCHAR(20) DEFAULT 'confirmed'")


def _add_column(conn, insp, dialect: str, table: str, column: str, sqltype: str) -> None:
    cols = {c["name"] for c in insp.get_columns(table)}
    if column in cols:
        return
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sqltype}"))


def get_or_create_catalog(db: Session) -> Client:
    row = db.query(Client).filter(Client.slug == CATALOG_SLUG).one_or_none()
    if row:
        return row
    row = Client(
        slug=CATALOG_SLUG,
        name="Catalog / Samples",
        industry="",
        description="Test lab. Mixed functions and industries. Not a census.",
        kind="catalog",
    )
    db.add(row)
    db.flush()
    return row


def get_or_create_client_a(db: Session) -> Client:
    row = db.query(Client).filter(Client.slug == CLIENT_A_SLUG).one_or_none()
    if row:
        return row
    row = Client(
        slug=CLIENT_A_SLUG,
        name="Client A",
        industry="Cross-Industry",
        description="Demo employer. Census wedge: HR & People Ops (cloned ONB/OFF only).",
        kind="client",
    )
    db.add(row)
    db.flush()
    return row


def assign_orphans_to_catalog(db: Session, catalog: Client) -> None:
    db.query(WorkUnit).filter(WorkUnit.client_id.is_(None)).update({"client_id": catalog.id})
    db.flush()


def clone_cross_industry_hr(db: Session, catalog: Client, target: Client) -> int:
    existing = {u.code for u in db.query(WorkUnit).filter(WorkUnit.client_id == target.id).all()}
    sources = (
        db.query(WorkUnit)
        .filter(WorkUnit.client_id == catalog.id)
        .order_by(WorkUnit.id)
        .all()
    )
    created = 0
    for src in sources:
        if not is_cross_industry_hr(src.code) or src.code in existing:
            continue
        wu = WorkUnit(client_id=target.id, **{f: getattr(src, f) for f in CLONE_FIELDS})
        wu.status = src.status
        db.add(wu)
        created += 1
    db.flush()
    return created


def bootstrap_tenants(db: Session) -> dict:
    catalog = get_or_create_catalog(db)
    client_a = get_or_create_client_a(db)
    assign_orphans_to_catalog(db, catalog)
    cloned = clone_cross_industry_hr(db, catalog, client_a)
    db.commit()
    return {
        "catalog_id": catalog.id,
        "client_a_id": client_a.id,
        "cloned_hr": cloned,
    }
