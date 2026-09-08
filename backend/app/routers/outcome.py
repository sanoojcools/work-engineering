"""V10-5 (docs/NEXT.md): outcome record API. Mounted at the same
"/work-systems" prefix as routers/work_systems.py, in a separate file for
the same reason routers/verification_design.py gives for staying apart from
routers/work_units.py -- keeps this slice's diff self-contained. GET never
404s: a Work System with no outcome_records row yet gets one auto-created
with the honest default (promised = its own sitting outcome sentence,
measured = null, status = not_measured) rather than an empty response a
caller has to special-case."""
from __future__ import annotations

from fastapi import APIRouter

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.outcome import OutcomeRecord
from ..models.work_system import WorkSystem
from ..schemas.outcome import OutcomeMeasureIn, OutcomeOut
from ..services import outcome as outcome_svc
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/{work_system_id}/outcome", response_model=OutcomeOut)
def get_outcome(work_system_id: int, db: TenantDbDep, key: OrgKeyDep) -> OutcomeRecord:
    ws = get_or_404(db, WorkSystem, work_system_id, "WorkSystem")
    return outcome_svc.get_or_create(db, ws)


@router.put("/{work_system_id}/outcome", response_model=OutcomeOut)
def put_outcome(
    work_system_id: int, payload: OutcomeMeasureIn, db: TenantDbDep, key: OrgKeyDep,
) -> OutcomeRecord:
    ws = get_or_404(db, WorkSystem, work_system_id, "WorkSystem")
    return outcome_svc.record_measurement(db, ws, payload.measured, payload.source)
