"""MANDATE-4 (docs/contracts/mandate-4-shadow.md): shadow_logs backend.
Mounted at the same "/work-units" prefix as routers/field_ratifications.py,
same reasoning -- keeps this slice's diff self-contained. Keyed (401
without an X-Spec-Key), tenant-scoped via TenantDbDep/RLS."""
from __future__ import annotations

from fastapi import APIRouter, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.workunit import WorkUnit
from ..schemas.shadow_log import ShadowLogCreateIn, ShadowLogOut, ShadowSummaryOut
from ..services import shadow_log as shadow_log_svc
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/{work_unit_id}/shadow-logs", response_model=list[ShadowLogOut])
def list_shadow_logs(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> list[ShadowLogOut]:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return shadow_log_svc.list_for_unit(db, work_unit_id)


@router.post("/{work_unit_id}/shadow-logs", response_model=ShadowLogOut, status_code=status.HTTP_201_CREATED)
def create_shadow_log(
    work_unit_id: int, payload: ShadowLogCreateIn, db: TenantDbDep, key: OrgKeyDep,
) -> ShadowLogOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return shadow_log_svc.create_log(
        db, wu, key,
        occurred_at=payload.occurred_at,
        duration_minutes=payload.duration_minutes,
        note=payload.note,
    )


@router.get("/{work_unit_id}/shadow-summary", response_model=ShadowSummaryOut)
def shadow_summary(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> ShadowSummaryOut:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return shadow_log_svc.summary(db, work_unit_id)
