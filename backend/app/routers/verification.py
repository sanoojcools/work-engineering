from fastapi import APIRouter, status

from ..dependencies import DbDep
from ..models.verification import AutonomyChange, VerificationRun
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.execution import AutonomyChangeOut, VerificationRunCreate, VerificationRunOut
from ..services import promotion
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/runs", response_model=Page[VerificationRunOut])
def list_runs(db: DbDep) -> Page[VerificationRunOut]:
    rows = db.query(VerificationRun).order_by(VerificationRun.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/runs", response_model=VerificationRunOut, status_code=status.HTTP_201_CREATED)
def create_run(payload: VerificationRunCreate, db: DbDep) -> VerificationRun:
    wu = get_or_404(db, WorkUnit, payload.work_unit_id, "WorkUnit")
    row = VerificationRun(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    promotion.maybe_autodemote(db, wu)
    db.refresh(row)
    return row


@router.get("/autonomy-changes", response_model=Page[AutonomyChangeOut])
def list_changes(db: DbDep) -> Page[AutonomyChangeOut]:
    rows = db.query(AutonomyChange).order_by(AutonomyChange.id).all()
    return Page(total=len(rows), items=rows)
