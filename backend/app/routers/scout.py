"""Scout Elevated V2 PR1: interview sessions + live Work Capture Grid.
Same OrgKeyDep/TenantDbDep pattern as work_units/consent (Slice 3 PR 3a/3c)
-- tenant-scoped via X-Spec-Key, RLS via app.current_client_id. No LLM
calls anywhere in this file: LLM_PROVIDER is unconfigured in this
environment, so completeness is computed from structured fields the
interviewee (or the interviewer, on her behalf) fills in directly --
see services/scout.py for the honest accounting of which of the 8
design-doc dimensions that actually covers."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.scout import InterviewStatus, InterviewType, ScoutCapturedUnit, ScoutInterviewSession
from ..models.security import AuditLog, OrgApiKey
from ..schemas.common import Page
from ..schemas.scout import SessionCreate, SessionOut, UnitCreate, UnitOut, UnitUpdate
from ..services import scout as scout_svc
from ..services.lookup import get_or_404

router = APIRouter()


def _rebind_tenant(db: TenantDbDep, key: OrgApiKey) -> None:
    """tenant_db() sets app.current_client_id once, at request start. A
    plain Session.commit() ends that transaction and can hand the next
    query a different pooled connection -- one without the SET applied --
    which makes RLS see zero rows and turns a routine post-commit
    db.refresh()/relationship read into "Could not refresh instance" (the
    same class of bug as Scout-State.md's documented Bug 4, just surfacing
    after an in-request commit rather than across SET LOCAL boundaries).
    Call this right after every commit(), before any further read."""
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})


def _to_session_out(session: ScoutInterviewSession) -> SessionOut:
    units = list(session.units)
    dimensions = scout_svc.compute_dimensions(units)
    return SessionOut(
        id=session.id,
        type=session.type.value,
        interviewee_name=session.interviewee_name,
        status=session.status.value,
        completeness_pct=session.completeness_pct,
        consent_receipt_id=session.consent_receipt_id,
        dimensions=dimensions,
        units=[scout_svc.unit_to_out(u) for u in units],
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def _recompute(db: TenantDbDep, session: ScoutInterviewSession) -> None:
    dimensions = scout_svc.compute_dimensions(list(session.units))
    session.completeness_pct = scout_svc.compute_completeness_pct(dimensions)


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreate, db: TenantDbDep, key: OrgKeyDep) -> SessionOut:
    session = ScoutInterviewSession(
        client_id=key.client_id,
        type=InterviewType(payload.type),
        interviewee_name=payload.interviewee_name,
        status=InterviewStatus.in_progress,
        consent_receipt_id=payload.consent_receipt_id,
    )
    db.add(session)
    db.flush()
    db.add(AuditLog(
        client_id=key.client_id,
        actor=key.label or f"org_api_key:{key.id}",
        action="scout.session.create",
        resource="scout_interview_session",
        resource_id=str(session.id),
        detail=f"type={payload.type}",
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(session)
    return _to_session_out(session)


@router.get("/sessions", response_model=Page[SessionOut])
def list_sessions(db: TenantDbDep, key: OrgKeyDep) -> Page[SessionOut]:
    rows = db.query(ScoutInterviewSession).order_by(ScoutInterviewSession.id.desc()).all()
    return Page(total=len(rows), items=[_to_session_out(r) for r in rows])


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db: TenantDbDep, key: OrgKeyDep) -> SessionOut:
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    return _to_session_out(session)


@router.post("/sessions/{session_id}/units", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def add_unit(session_id: int, payload: UnitCreate, db: TenantDbDep, key: OrgKeyDep) -> SessionOut:
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    unit = ScoutCapturedUnit(
        session_id=session.id,
        client_id=key.client_id,
        name=payload.name, inputs=payload.inputs, outputs=payload.outputs,
        systems=payload.systems, frequency=payload.frequency, time_minutes=payload.time_minutes,
        pain=payload.pain, handoffs=payload.handoffs, decision_rule=payload.decision_rule,
    )
    db.add(unit)
    db.flush()
    # Don't append(unit) here: session.units is still unloaded at this
    # point, so the first access below (inside _recompute) lazy-loads it
    # straight from the just-flushed row -- appending first would double
    # it up (identity-mapped object appended, then loaded again by the
    # lazy SELECT), inflating every dimension's captured/expected count.
    _recompute(db, session)
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="scout.unit.create", resource="scout_captured_unit", resource_id=str(unit.id),
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(session)
    return _to_session_out(session)


@router.patch("/sessions/{session_id}/units/{unit_id}", response_model=SessionOut)
def update_unit(session_id: int, unit_id: int, payload: UnitUpdate, db: TenantDbDep, key: OrgKeyDep) -> SessionOut:
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    unit = get_or_404(db, ScoutCapturedUnit, unit_id, "ScoutCapturedUnit")
    if unit.session_id != session.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"ScoutCapturedUnit {unit_id} not found in session {session_id}")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(unit, field, value)
    _recompute(db, session)
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="scout.unit.update", resource="scout_captured_unit", resource_id=str(unit.id),
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(session)
    return _to_session_out(session)


@router.post("/sessions/{session_id}/complete", response_model=SessionOut)
def complete_session(session_id: int, db: TenantDbDep, key: OrgKeyDep) -> SessionOut:
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    session.status = InterviewStatus.completed
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="scout.session.complete", resource="scout_interview_session", resource_id=str(session.id),
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(session)
    return _to_session_out(session)
