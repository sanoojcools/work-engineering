from fastapi import APIRouter, HTTPException, status

from ..config import settings
from ..dependencies import DbDep, SystemDbDep
from ..models.workunit import WorkUnit
from ..seed import seed

router = APIRouter()


@router.post("/seed")
def run_seed(db: DbDep) -> dict:
    """Load the order-to-cash census if it is not already present."""
    seed(db)
    from ..services.tenants import bootstrap_tenants
    bootstrap_tenants(db)
    count = db.query(WorkUnit).count()
    return {"status": "ok", "work_units": count}


@router.post("/demo/prepare")
def prepare_demo(db: SystemDbDep) -> dict:
    """Catalog 12 HR units, clone to Client A, run inferred HR census with sample SOP.

    Cross-tenant by nature — it writes both the shared Catalog tenant and
    Client A — so it runs on the RLS-bypassing system session. On the plain
    per-request DbDep every work_units INSERT was rejected outright
    ("new row violates row-level security policy"), because that session has
    no app.current_client_id and this endpoint has no single tenant to bind
    to."""
    from ..services.demo import prepare_demo as run
    return run(db)


@router.post("/demo/bootstrap")
def bootstrap_demo(db: SystemDbDep) -> dict:
    """One-call local demo setup: seeds Client A's HR census AND mints its
    first org API key, returning the plaintext once. Before this existed,
    standing up a demo meant running a Python snippet against the database
    by hand to insert an org_api_keys row (routers/org.py can only rotate a
    key you already hold), which is where local setup reliably fell over.

    Hands out a credential over an unauthenticated request, so it is gated
    by settings.demo_bootstrap_enabled and must be false outside a
    throwaway local database."""
    if not settings.demo_bootstrap_enabled:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Demo bootstrap is disabled (DEMO_BOOTSTRAP_ENABLED=false). It mints an API key "
            "over an unauthenticated request and is only for a local demo database.",
        )
    from ..services.demo import bootstrap_demo as run
    return run(db)


@router.post("/admin/consent/purge")
def run_consent_purge(db: SystemDbDep) -> dict:
    """Manual trigger for the daily consent-purge sweep (Slice 3 PR 3c).
    Cross-tenant by nature, so it runs on the system session rather than the
    per-request DbDep, which would see zero rows under RLS with no
    app.current_client_id set."""
    from ..services.consent_purge import purge_expired_consents
    return {"purged": purge_expired_consents(db)}
