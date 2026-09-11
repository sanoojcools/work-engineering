"""V10-11 (docs/contracts/v10-11-states.md): GET
/api/work-systems/{id}/admissibility -- this journey only. Mounted at the
same "/work-systems" prefix as routers/outcome.py, in its own file for the
same self-contained-diff reason that file gives."""
from __future__ import annotations

from fastapi import APIRouter

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.work_system import WorkSystem
from ..schemas.admissibility import AdmissibilityOut, RefusalOut
from ..services import admissibility as admissibility_svc
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/{work_system_id}/admissibility", response_model=AdmissibilityOut)
def get_admissibility(work_system_id: int, db: TenantDbDep, key: OrgKeyDep) -> AdmissibilityOut:
    ws = get_or_404(db, WorkSystem, work_system_id, "WorkSystem")
    refusals = admissibility_svc.check(db, key.client_id)
    return AdmissibilityOut(
        work_system_id=ws.id,
        refusals=[
            RefusalOut(work_unit_id=r.work_unit_id, code=r.code, reason=r.reason, detail=r.detail)
            for r in refusals
        ],
    )
