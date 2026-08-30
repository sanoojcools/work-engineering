from fastapi import APIRouter

from ..dependencies import DbDep
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
def prepare_demo(db: DbDep) -> dict:
    """Catalog 12 HR units, clone to Client A, run inferred HR census with sample SOP."""
    from ..services.demo import prepare_demo as run
    return run(db)


@router.post("/admin/consent/purge")
def run_consent_purge() -> dict:
    """Manual trigger for the daily consent-purge sweep (Slice 3 PR 3c).
    Cross-tenant by nature, so — like bootstrap_tenants above — this opens
    its own SystemSessionLocal rather than using the per-request DbDep,
    which would see zero rows under RLS with no app.current_client_id set."""
    from ..db import SystemSessionLocal
    from ..services.consent_purge import purge_expired_consents
    db = SystemSessionLocal()
    try:
        count = purge_expired_consents(db)
    finally:
        db.close()
    return {"purged": count}
