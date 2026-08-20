from fastapi import APIRouter

from ..dependencies import DbDep
from ..models.workunit import WorkUnit
from ..seed import seed

router = APIRouter()


@router.post("/seed")
def run_seed(db: DbDep) -> dict:
    """Load the order-to-cash census if it is not already present."""
    seed(db)
    count = db.query(WorkUnit).count()
    return {"status": "ok", "work_units": count}
