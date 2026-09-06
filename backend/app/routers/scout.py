"""Scout Elevated V2 PR1: interview sessions + live Work Capture Grid.
Same OrgKeyDep/TenantDbDep pattern as work_units/consent (Slice 3 PR 3a/3c)
-- tenant-scoped via X-Spec-Key, RLS via app.current_client_id. No LLM
calls anywhere in this file: LLM_PROVIDER is unconfigured in this
environment, so completeness is computed from structured fields the
interviewee (or the interviewer, on her behalf) fills in directly --
see services/scout.py for the honest accounting of which of the 8
design-doc dimensions that actually covers."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.scout import (
    ContradictionStatus,
    InterviewStatus,
    InterviewType,
    ScoutBlastRadiusSelection,
    ScoutCapturedUnit,
    ScoutContradiction,
    ScoutInterviewSession,
)
from ..models.security import AuditLog, ConsentReceipt, OrgApiKey
from ..schemas.common import Page
from ..schemas.scout import (
    BlastRadiusOut,
    BlastRadiusSelectionUpdate,
    ContradictionOut,
    ContradictionResolve,
    FuturePreviewOut,
    GenerateGenomeOut,
    PersistTalkOnlyIn,
    PersistTalkOnlyOut,
    PainHeatmapOut,
    SessionConsentUpdate,
    SessionCreate,
    SessionOut,
    StoryExtractIn,
    StoryExtractOut,
    TimelineOut,
    TimelineUpdate,
    UnitCreate,
    UnitOut,
    UnitUpdate,
)
from ..services import offer_desk_persist as persist_svc
from ..services import scout as scout_svc
from ..services import scout_blast_radius as blast_radius_svc
from ..services import scout_contradictions as contradiction_svc
from ..services import scout_future as future_svc
from ..services import scout_genome as genome_svc
from ..services import scout_pain as pain_svc
from ..services import scout_story as story_svc
from ..services import scout_timeline as timeline_svc
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


@router.patch("/sessions/{session_id}/consent-receipt", response_model=SessionOut)
def update_session_consent(
    session_id: int, payload: SessionConsentUpdate, db: TenantDbDep, key: OrgKeyDep
) -> SessionOut:
    """Slice 2.1: attach a consent receipt to a session created before one was
    picked. get_or_404 on ConsentReceipt is the tenant check -- RLS plus its
    own client_id filter means a receipt id from another tenant 404s the
    same as one that doesn't exist. Does not itself judge active/withdrawn:
    that's genome_import.py::_validate_consent's job at generate-genome time,
    same as any other consent_receipt_id (see that function's docstring)."""
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    get_or_404(db, ConsentReceipt, payload.consent_receipt_id, "ConsentReceipt")
    session.consent_receipt_id = payload.consent_receipt_id
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="scout.session.consent_receipt.attach", resource="scout_interview_session",
        resource_id=str(session.id), detail=f"consent_receipt_id={payload.consent_receipt_id}",
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(session)
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


def _contradiction_to_out(c: ScoutContradiction) -> ContradictionOut:
    return ContradictionOut(
        id=c.id, unit_name=c.unit_name, field=c.field,
        founder_session_id=c.founder_session_id, sme_session_id=c.sme_session_id,
        founder_text=c.founder_text, sme_text=c.sme_text,
        confidence=c.confidence, resolution=c.resolution,
        status=c.status.value, created_at=c.created_at,
    )


@router.get("/sessions/{session_id}/timeline", response_model=TimelineOut)
def get_timeline(session_id: int, db: TenantDbDep, key: OrgKeyDep) -> TimelineOut:
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    stored = json.loads(session.timeline_json)
    if not stored:
        stored = timeline_svc.build_timeline(list(session.units))
        session.timeline_json = json.dumps(stored)
        db.commit()
        _rebind_tenant(db, key)
        db.refresh(session)
    return TimelineOut(**stored)


@router.post("/sessions/{session_id}/timeline/rebuild", response_model=TimelineOut)
def rebuild_timeline(session_id: int, db: TenantDbDep, key: OrgKeyDep) -> TimelineOut:
    """Re-run the deterministic placement from current units, discarding
    any manual drag corrections. Separate from PATCH so a manual edit is
    never silently clobbered by a routine GET."""
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    stored = timeline_svc.build_timeline(list(session.units))
    session.timeline_json = json.dumps(stored)
    db.commit()
    return TimelineOut(**stored)


@router.patch("/sessions/{session_id}/timeline", response_model=TimelineOut)
def update_timeline(session_id: int, payload: TimelineUpdate, db: TenantDbDep, key: OrgKeyDep) -> TimelineOut:
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    session.timeline_json = json.dumps(payload.timeline)
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="scout.timeline.update", resource="scout_interview_session", resource_id=str(session.id),
    ))
    db.commit()
    return TimelineOut(**payload.timeline)


@router.get("/contradictions", response_model=Page[ContradictionOut])
def list_contradictions(db: TenantDbDep, key: OrgKeyDep, session_id: int | None = None) -> Page[ContradictionOut]:
    contradiction_svc.detect_and_upsert(db, key.client_id)
    db.commit()
    _rebind_tenant(db, key)
    q = db.query(ScoutContradiction)
    if session_id is not None:
        q = q.filter(
            (ScoutContradiction.founder_session_id == session_id)
            | (ScoutContradiction.sme_session_id == session_id)
        )
    rows = q.order_by(ScoutContradiction.id).all()
    return Page(total=len(rows), items=[_contradiction_to_out(r) for r in rows])


@router.post("/contradictions/{contradiction_id}/resolve", response_model=ContradictionOut)
def resolve_contradiction(
    contradiction_id: int, payload: ContradictionResolve, db: TenantDbDep, key: OrgKeyDep
) -> ContradictionOut:
    row = get_or_404(db, ScoutContradiction, contradiction_id, "ScoutContradiction")
    row.resolution = payload.resolution
    row.status = ContradictionStatus.resolved
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="scout.contradiction.resolve", resource="scout_contradiction", resource_id=str(row.id),
    ))
    db.commit()
    return _contradiction_to_out(row)


@router.get("/sessions/{session_id}/pain-heatmap", response_model=PainHeatmapOut)
def get_pain_heatmap(session_id: int, db: TenantDbDep, key: OrgKeyDep) -> PainHeatmapOut:
    """Design doc scopes this org-wide (?org_id=...); this scopes it to one
    session's units instead, consistent with every other elevation here and
    simpler to reason about (a function_head session naming no systems would
    otherwise dilute an SME session's real pain signal). See HONESTY.md."""
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    return PainHeatmapOut(**pain_svc.build_pain_heatmap(list(session.units)))


@router.post("/extract-from-story", response_model=StoryExtractOut)
def extract_from_story(payload: StoryExtractIn, key: OrgKeyDep) -> StoryExtractOut:
    """Tenant-scoped like everything else here (needs a valid X-Spec-Key),
    but doesn't touch the database -- it's a pure text transform, real
    LLM extraction or the deterministic fallback (see services/scout_story.py)."""
    return StoryExtractOut(**story_svc.extract_from_story(payload.transcript_chunk))


@router.get("/sessions/{session_id}/future-preview", response_model=FuturePreviewOut)
def get_future_preview(session_id: int, db: TenantDbDep, key: OrgKeyDep) -> FuturePreviewOut:
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    return FuturePreviewOut(**future_svc.build_future_preview(session))


@router.post("/sessions/{session_id}/generate-genome", response_model=GenerateGenomeOut)
def generate_genome(session_id: int, db: TenantDbDep, key: OrgKeyDep) -> GenerateGenomeOut:
    """Calls the EXISTING genome import pipeline (services/genome_import
    .import_genome) with a best-effort mapping from captured units -- see
    services/scout_genome.py's module docstring for exactly which of the
    18 attributes are real vs. an honest placeholder. Same GQS gate as
    every other import path: a thin session's genome can, correctly,
    fail to pass."""
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    if not session.units:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No captured units to generate a genome from")
    # Slice 2.1: fail fast, before the (real) import pipeline even runs GQS --
    # same missing_consent rule genome_import.py::_validate_consent enforces
    # deeper in, just surfaced as an actual 4xx here instead of a 200 with
    # accepted=false, since the UI now guarantees this is always avoidable
    # (Consent screen runs before this call, see ConsentGate.tsx).
    if not session.consent_receipt_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This session has no consent record attached yet -- pick or create one before generating a genome.",
        )
    result = genome_svc.generate_genome(db, session, actor=key.label or f"org_api_key:{key.id}")
    _rebind_tenant(db, key)
    return GenerateGenomeOut(**result)


@router.post("/sessions/{session_id}/persist-talk-only", response_model=PersistTalkOnlyOut)
def persist_talk_only(
    session_id: int,
    payload: PersistTalkOnlyIn,
    db: TenantDbDep,
    key: OrgKeyDep,
) -> PersistTalkOnlyOut:
    """V9 Slice C. Wraps generate_genome / GQS. Completeness is not clearance."""
    session = get_or_404(db, ScoutInterviewSession, session_id, "ScoutInterviewSession")
    if not session.units:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No captured units to persist")
    result = persist_svc.persist_talk_only(
        db,
        session,
        actor=key.label or f"org_api_key:{key.id}",
        sheet_attached=payload.sheet_attached,
    )
    _rebind_tenant(db, key)
    return PersistTalkOnlyOut(**result)


@router.get("/blast-radius", response_model=BlastRadiusOut)
def get_blast_radius(db: TenantDbDep, key: OrgKeyDep) -> BlastRadiusOut:
    """The 44-sub-function HR catalog (services/scout_blast_radius.py) is a
    published constant, not tenant data -- what's tenant-scoped is which
    rows a CHRO has actually touched, RLS-isolated same as every other
    scout_* table."""
    rows = db.query(ScoutBlastRadiusSelection).all()
    return blast_radius_svc.build_blast_radius(rows)


@router.patch("/blast-radius/{sub_function_key}", response_model=BlastRadiusOut)
def update_blast_radius_selection(
    sub_function_key: str, payload: BlastRadiusSelectionUpdate, db: TenantDbDep, key: OrgKeyDep
) -> BlastRadiusOut:
    if sub_function_key not in blast_radius_svc.CATALOG_KEYS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown sub-function {sub_function_key!r}")
    row = (
        db.query(ScoutBlastRadiusSelection)
        .filter(ScoutBlastRadiusSelection.sub_function_key == sub_function_key)
        .one_or_none()
    )
    if row is None:
        row = ScoutBlastRadiusSelection(client_id=key.client_id, sub_function_key=sub_function_key)
        db.add(row)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.flush()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="scout.blast_radius.update", resource="scout_blast_radius_selection",
        resource_id=sub_function_key,
    ))
    db.commit()
    _rebind_tenant(db, key)
    rows = db.query(ScoutBlastRadiusSelection).all()
    return blast_radius_svc.build_blast_radius(rows)
