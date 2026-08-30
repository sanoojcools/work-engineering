from fastapi import APIRouter, Query, status

from ..dependencies import DbDep
from ..models.verdict import VerdictScore
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.graph import VerdictIn, VerdictOut
from ..services import work_units as wu_svc
from ..services.lookup import get_or_404
from ..services.tenants import units_query

router = APIRouter()


@router.get("/", response_model=Page[VerdictOut])
def list_scores(db: DbDep, client_id: int | None = Query(default=None)) -> Page[VerdictOut]:
    ids = {u.id for u in units_query(db, client_id).all()} if client_id is not None else None
    q = db.query(VerdictScore).order_by(VerdictScore.id)
    rows = q.all()
    if ids is not None:
        rows = [r for r in rows if r.work_unit_id in ids]
    return Page(total=len(rows), items=[VerdictOut(**wu_svc.verdict_out(r)) for r in rows])


@router.put("/{work_unit_id}", response_model=VerdictOut)
def upsert_score(work_unit_id: int, payload: VerdictIn, db: DbDep) -> VerdictOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = wu_svc.apply_verdict(db, wu, payload.model_dump())
    return VerdictOut(**wu_svc.verdict_out(row))


@router.get("/{work_unit_id}", response_model=VerdictOut)
def get_score(work_unit_id: int, db: DbDep) -> VerdictOut:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = db.query(VerdictScore).filter(VerdictScore.work_unit_id == work_unit_id).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No VERDICT score for this unit")
    return VerdictOut(**wu_svc.verdict_out(row))
