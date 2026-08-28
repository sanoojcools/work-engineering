"""C4 spec-consumption surface for execution systems. Slice 3 PR 3a: moved off
the legacy global spec_api_key onto per-org X-Spec-Key (OrgKeyDep/TenantDbDep),
the same credential genome import and files already use — see
dependencies.require_org_api_key."""
from fastapi import APIRouter, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.execution import SpecCheck, Trajectory
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.execution import SpecCheckIn, SpecCheckOut, TrajectoryIn, TrajectoryOut
from ..schemas.workunit import WorkUnitOut
from ..services import spec as spec_svc
from ..services import work_units as wu_svc
from ..services.lookup import get_by_code_or_404

router = APIRouter()


@router.get("/work-units/{code}", response_model=WorkUnitOut)
def get_spec(code: str, db: TenantDbDep, _key: OrgKeyDep) -> WorkUnitOut:
    """The specification an execution system consumes (C4)."""
    wu = get_by_code_or_404(db, WorkUnit, code)
    return wu_svc.to_out(wu)


@router.post("/check", response_model=SpecCheckOut)
def check(payload: SpecCheckIn, db: TenantDbDep, _key: OrgKeyDep) -> SpecCheckOut:
    wu = get_by_code_or_404(db, WorkUnit, payload.work_unit_code)
    row = spec_svc.enforce(
        db,
        wu,
        payload.check_type,
        caller=payload.caller,
        approver=payload.approver,
        actor=payload.actor,
        evidence_ref=payload.evidence_ref,
        object_state=payload.object_state,
    )
    return row


@router.get("/checks", response_model=Page[SpecCheckOut])
def list_checks(db: TenantDbDep, _key: OrgKeyDep) -> Page[SpecCheckOut]:
    rows = db.query(SpecCheck).order_by(SpecCheck.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/trajectories", response_model=TrajectoryOut, status_code=status.HTTP_201_CREATED)
def create_trajectory(payload: TrajectoryIn, db: TenantDbDep, _key: OrgKeyDep) -> Trajectory:
    wu = get_by_code_or_404(db, WorkUnit, payload.work_unit_code)
    data = payload.model_dump()
    data.pop("work_unit_code")
    row = Trajectory(work_unit_id=wu.id, **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/trajectories", response_model=Page[TrajectoryOut])
def list_trajectories(db: TenantDbDep, _key: OrgKeyDep) -> Page[TrajectoryOut]:
    rows = db.query(Trajectory).order_by(Trajectory.id).all()
    return Page(total=len(rows), items=rows)
