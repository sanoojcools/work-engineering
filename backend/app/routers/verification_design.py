"""V10-3 (docs/V10_BUILD.md): verification design + certification API.
Mounted at the same "/work-units" prefix as routers/pointers.py, for the
same reason that file gives -- keeps this slice's diff self-contained and
independently reviewable, and keeps the resource nested under the unit it
belongs to."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.verification_design import VerificationDesign
from ..models.workunit import WorkUnit
from ..schemas.verification_design import VerificationDesignIn, VerificationDesignOut
from ..services import verification_design as vd_svc
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/{work_unit_id}/verification-design", response_model=VerificationDesignOut)
def get_design(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> VerificationDesign:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = db.query(VerificationDesign).filter(VerificationDesign.work_unit_id == work_unit_id).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No verification design recorded for this unit")
    return row


@router.put("/{work_unit_id}/verification-design", response_model=VerificationDesignOut)
def put_design(
    work_unit_id: int, payload: VerificationDesignIn, db: TenantDbDep, key: OrgKeyDep,
) -> VerificationDesign:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return vd_svc.upsert_design(db, wu, payload.model_dump())
