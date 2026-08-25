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
