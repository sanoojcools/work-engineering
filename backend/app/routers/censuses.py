"""V10-1 BACKEND (docs/V10_BUILD.md): censuses table + get-or-create/start.

Same OrgKeyDep/TenantDbDep + RLS pattern as work_systems (549fc2e9287a) --
one row per (tenant, work_system). Readiness is computed live off existing
tables on every response (services/censuses.py); this router never writes
consent/scout/file data itself and never invents a document-received flag.

Deliberately a separate module from routers/census.py (singular) -- that
one is the pre-existing "one-click function census" draft-VERDICT/cost
feature at /api/census, unrelated to this table and route."""
from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.censuses import Census, CensusStatus
from ..models.security import AuditLog
from ..models.work_system import WorkSystem
from ..schemas.censuses import CensusEnsureIn, CensusOut
from ..schemas.common import Page
from ..services import censuses as censuses_svc
from ..services.lookup import get_or_404

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _rebind_tenant(db: TenantDbDep, key) -> None:
    # Same post-commit re-SET this codebase already relies on elsewhere
    # (scout.py's/work_systems.py's own _rebind_tenant) -- a plain commit()
    # can hand the next query a pooled connection without
    # app.current_client_id applied.
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})


@router.get("", response_model=Page[CensusOut])
def list_censuses(db: TenantDbDep, key: OrgKeyDep) -> Page[CensusOut]:
    rows = db.query(Census).order_by(Census.id).all()
    return Page(total=len(rows), items=[censuses_svc.to_out(db, r) for r in rows])


@router.post("", response_model=CensusOut, status_code=status.HTTP_201_CREATED)
def ensure_census(payload: CensusEnsureIn, db: TenantDbDep, key: OrgKeyDep) -> CensusOut:
    # 404s on a missing or cross-tenant work_system_id -- RLS already
    # scopes this query to the caller's own tenant, same ownership check
    # census/consent/work_units already apply to a caller-supplied id.
    get_or_404(db, WorkSystem, payload.work_system_id, "WorkSystem")

    existing = db.query(Census).filter(Census.work_system_id == payload.work_system_id).one_or_none()
    if existing is not None:
        return censuses_svc.to_out(db, existing)

    row = Census(
        client_id=key.client_id,
        work_system_id=payload.work_system_id,
        scope=json.dumps(payload.scope),
        document_requests=json.dumps(payload.document_requests),
    )
    db.add(row)
    db.flush()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="census.create", resource="census", resource_id=str(row.id),
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return censuses_svc.to_out(db, row)


@router.post("/{census_id}/start", response_model=CensusOut)
def start_census(census_id: int, db: TenantDbDep, key: OrgKeyDep) -> CensusOut:
    row: Census = get_or_404(db, Census, census_id, "Census")
    if row.status == CensusStatus.started:
        raise HTTPException(status.HTTP_409_CONFLICT, "Census already started")
    row.status = CensusStatus.started
    row.started_at = _utcnow()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="census.start", resource="census", resource_id=str(row.id),
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return censuses_svc.to_out(db, row)
