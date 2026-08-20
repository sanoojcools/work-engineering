from fastapi import APIRouter, HTTPException, status

from ..dependencies import DbDep
from ..models.economics import CostProfile
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.graph import CostIn, CostOut
from ..services.economics import from_profile
from ..services.lookup import get_or_404

router = APIRouter()


def _out(row: CostProfile) -> CostOut:
    data = CostOut.model_validate(row)
    return data.model_copy(update={"computed": from_profile(row)})


@router.get("/", response_model=Page[CostOut])
def list_profiles(db: DbDep) -> Page[CostOut]:
    rows = db.query(CostProfile).order_by(CostProfile.id).all()
    return Page(total=len(rows), items=[_out(r) for r in rows])


@router.put("/{work_unit_id}", response_model=CostOut)
def upsert_profile(work_unit_id: int, payload: CostIn, db: DbDep) -> CostOut:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = db.query(CostProfile).filter(CostProfile.work_unit_id == work_unit_id).one_or_none()
    if row is None:
        row = CostProfile(work_unit_id=work_unit_id, **payload.model_dump())
        db.add(row)
    else:
        for field, value in payload.model_dump().items():
            setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return _out(row)


@router.get("/{work_unit_id}", response_model=CostOut)
def get_profile(work_unit_id: int, db: DbDep) -> CostOut:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = db.query(CostProfile).filter(CostProfile.work_unit_id == work_unit_id).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No cost profile for this unit")
    return _out(row)
