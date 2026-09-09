"""CENSUS-v0 Part B: One Work System. GET lists a tenant's rows (usually
zero, since nothing seeds one automatically -- honest "not created yet"
rather than a phantom default). POST is get-or-create by (tenant, code),
called by the Work Chart page with this journey's own real fields (sourced
client-side, verbatim, from OFFER_DESK_META / ONBOARDING_SPEC -- see
frontend/src/lib/workSystem.ts) the first time a keyed tenant opens it.
Ratify is the one state change: candidate -> ratified, with a real name and
a server timestamp (V10 rule -- a candidate Work System must not be cut into
governed units until this happens)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.security import AuditLog
from ..models.work_system import WorkSystem, WorkSystemStatus
from ..schemas.common import Page
from ..schemas.work_system import (
    WorkSystemEnsureIn,
    WorkSystemIntentConfirmIn,
    WorkSystemOut,
    WorkSystemRatifyIn,
)
from ..services import work_system as work_system_svc
from ..services.lookup import get_or_404

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _rebind_tenant(db: TenantDbDep, key) -> None:
    # Same post-commit re-SET this codebase already relies on elsewhere
    # (scout.py's _rebind_tenant) -- a plain commit() can hand the next
    # query a pooled connection without app.current_client_id applied.
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})


@router.get("", response_model=Page[WorkSystemOut])
def list_work_systems(db: TenantDbDep, key: OrgKeyDep) -> Page[WorkSystemOut]:
    rows = db.query(WorkSystem).order_by(WorkSystem.id).all()
    return Page(total=len(rows), items=[work_system_svc.to_out(r) for r in rows])


@router.post("", response_model=WorkSystemOut, status_code=status.HTTP_201_CREATED)
def ensure_work_system(payload: WorkSystemEnsureIn, db: TenantDbDep, key: OrgKeyDep) -> WorkSystemOut:
    existing = db.query(WorkSystem).filter(WorkSystem.code == payload.code).one_or_none()
    if existing is not None:
        return work_system_svc.to_out(existing)
    row = WorkSystem(
        client_id=key.client_id,
        code=payload.code,
        name=payload.name,
        entry=payload.entry,
        exit=payload.exit,
        owner=payload.owner,
        outcome=payload.outcome,
        function_intent_outcome=payload.function_intent_outcome,
        function_intent_owner=payload.function_intent_owner,
        function_intent_measure=payload.function_intent_measure,
        work_system_intent_purpose=payload.work_system_intent_purpose,
        work_system_intent_owner=payload.work_system_intent_owner,
        strategy_intent_focus=payload.strategy_intent_focus,
        strategy_intent_owner=payload.strategy_intent_owner,
    )
    db.add(row)
    db.flush()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="work_system.create", resource="work_system", resource_id=str(row.id),
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return work_system_svc.to_out(row)


@router.post("/{work_system_id}/ratify", response_model=WorkSystemOut)
def ratify_work_system(work_system_id: int, payload: WorkSystemRatifyIn, db: TenantDbDep, key: OrgKeyDep) -> WorkSystemOut:
    row: WorkSystem = get_or_404(db, WorkSystem, work_system_id, "WorkSystem")
    if row.status == WorkSystemStatus.ratified:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already ratified")
    row.status = WorkSystemStatus.ratified
    row.ratified_by = payload.ratified_by
    row.ratified_at = _utcnow()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="work_system.ratify", resource="work_system", resource_id=str(row.id),
        detail=f"ratified_by={payload.ratified_by}",
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return work_system_svc.to_out(row)


@router.post("/{work_system_id}/confirm-function-intent", response_model=WorkSystemOut)
def confirm_function_intent(work_system_id: int, payload: WorkSystemIntentConfirmIn, db: TenantDbDep, key: OrgKeyDep) -> WorkSystemOut:
    """D -- INTENT-LITE. 'Status draft until keyed Confirm as owner (name +
    time)' -- this endpoint is the entire state change: it never touches the
    intent's own outcome/owner/measure text (those are set once, at ensure
    time, and never overwritten -- same rule the journey's own entry/exit
    already follow)."""
    row: WorkSystem = get_or_404(db, WorkSystem, work_system_id, "WorkSystem")
    if row.function_intent_confirmed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Function intent already confirmed")
    row.function_intent_confirmed_by = payload.confirmed_by
    row.function_intent_confirmed_at = _utcnow()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="work_system.confirm_function_intent", resource="work_system", resource_id=str(row.id),
        detail=f"confirmed_by={payload.confirmed_by}",
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return work_system_svc.to_out(row)


@router.post("/{work_system_id}/confirm-work-system-intent", response_model=WorkSystemOut)
def confirm_work_system_intent(work_system_id: int, payload: WorkSystemIntentConfirmIn, db: TenantDbDep, key: OrgKeyDep) -> WorkSystemOut:
    row: WorkSystem = get_or_404(db, WorkSystem, work_system_id, "WorkSystem")
    if row.work_system_intent_confirmed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Work System intent already confirmed")
    row.work_system_intent_confirmed_by = payload.confirmed_by
    row.work_system_intent_confirmed_at = _utcnow()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="work_system.confirm_work_system_intent", resource="work_system", resource_id=str(row.id),
        detail=f"confirmed_by={payload.confirmed_by}",
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return work_system_svc.to_out(row)


@router.post("/{work_system_id}/confirm-strategy-intent", response_model=WorkSystemOut)
def confirm_strategy_intent(work_system_id: int, payload: WorkSystemIntentConfirmIn, db: TenantDbDep, key: OrgKeyDep) -> WorkSystemOut:
    """V10-9: third intent level, same one-time confirm shape as the two
    above -- never touches strategy_intent_focus/owner, which are set once
    at ensure time and never overwritten."""
    row: WorkSystem = get_or_404(db, WorkSystem, work_system_id, "WorkSystem")
    if row.strategy_intent_confirmed_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Strategy intent already confirmed")
    row.strategy_intent_confirmed_by = payload.confirmed_by
    row.strategy_intent_confirmed_at = _utcnow()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="work_system.confirm_strategy_intent", resource="work_system", resource_id=str(row.id),
        detail=f"confirmed_by={payload.confirmed_by}",
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return work_system_svc.to_out(row)
