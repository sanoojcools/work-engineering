from fastapi import APIRouter, Query, status

from ..config import settings
from ..dependencies import OptionalTenantDbDep
from ..models.discovery import ConformanceGap, DiscoveryCandidate, IntentSource, TraceEvent
from ..schemas.common import Page
from ..schemas.discovery import (
    CandidateCreate,
    CandidateOut,
    GapCreate,
    GapOut,
    IntentCreate,
    IntentOut,
    MergeIn,
    SuggestIn,
    TraceCreate,
    TraceOut,
)
from ..schemas.workunit import WorkUnitOut
from ..services import discovery as discovery_svc
from ..services.errors import RuleError
from ..services.lookup import get_or_404, http_rule
from ..services.work_units import to_out

router = APIRouter()


@router.get("/traces", response_model=Page[TraceOut])
def list_traces(db: OptionalTenantDbDep) -> Page[TraceOut]:
    rows = db.query(TraceEvent).order_by(TraceEvent.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/traces", response_model=TraceOut, status_code=status.HTTP_201_CREATED)
def create_trace(payload: TraceCreate, db: OptionalTenantDbDep) -> TraceEvent:
    row = TraceEvent(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/intent", response_model=Page[IntentOut])
def list_intent(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> Page[IntentOut]:
    q = db.query(IntentSource)
    if client_id is not None:
        q = q.filter(IntentSource.client_id == client_id)
    rows = q.order_by(IntentSource.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/intent", response_model=IntentOut, status_code=status.HTTP_201_CREATED)
def create_intent(payload: IntentCreate, db: OptionalTenantDbDep) -> IntentSource:
    row = IntentSource(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/candidates", response_model=Page[CandidateOut])
def list_candidates(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> Page[CandidateOut]:
    q = db.query(DiscoveryCandidate)
    if client_id is not None:
        q = q.filter(DiscoveryCandidate.client_id == client_id)
    rows = q.order_by(DiscoveryCandidate.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/candidates", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
def create_candidate(payload: CandidateCreate, db: OptionalTenantDbDep) -> DiscoveryCandidate:
    row = DiscoveryCandidate(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/candidates/{candidate_id}/reject", response_model=CandidateOut)
def reject_candidate(candidate_id: int, db: OptionalTenantDbDep) -> DiscoveryCandidate:
    row = get_or_404(db, DiscoveryCandidate, candidate_id, "Candidate")
    return discovery_svc.reject_candidate(db, row)


@router.post("/candidates/{candidate_id}/accept", response_model=WorkUnitOut)
def accept_candidate(candidate_id: int, db: OptionalTenantDbDep) -> WorkUnitOut:
    row = get_or_404(db, DiscoveryCandidate, candidate_id, "Candidate")
    try:
        wu = discovery_svc.accept_candidate(db, row)
    except RuleError as exc:
        raise http_rule(exc) from exc
    return to_out(wu)


@router.post("/candidates/{candidate_id}/merge", response_model=CandidateOut)
def merge_candidate(candidate_id: int, payload: MergeIn, db: OptionalTenantDbDep) -> DiscoveryCandidate:
    row = get_or_404(db, DiscoveryCandidate, candidate_id, "Candidate")
    try:
        return discovery_svc.merge_candidate(db, row, payload.work_unit_id)
    except RuleError as exc:
        raise http_rule(exc) from exc


@router.get("/gaps", response_model=Page[GapOut])
def list_gaps(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> Page[GapOut]:
    q = db.query(ConformanceGap)
    if client_id is not None:
        q = q.filter(ConformanceGap.client_id == client_id)
    rows = q.order_by(ConformanceGap.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/gaps", response_model=GapOut, status_code=status.HTTP_201_CREATED)
def create_gap(payload: GapCreate, db: OptionalTenantDbDep) -> ConformanceGap:
    row = ConformanceGap(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/gaps/scan", response_model=Page[GapOut])
def scan_gaps(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> Page[GapOut]:
    rows = discovery_svc.scan_gaps(db, client_id=client_id)
    return Page(total=len(rows), items=rows)


@router.post("/suggest")
def suggest(payload: SuggestIn, db: OptionalTenantDbDep) -> dict:
    """LLM-assisted candidates, persisted. Deterministic splitter when LLM is off."""
    if payload.persist:
        intent, rows = discovery_svc.persist_intake(
            db, payload.text, payload.origin, payload.title, payload.kind, payload.client_id
        )
        return {
            "provider": settings.llm_provider,
            "intent_id": intent.id,
            "items": [
                {
                    "id": r.id,
                    "name": r.name,
                    "origin": r.origin.value,
                    "payload": r.payload,
                    "sampling_bias_note": r.sampling_bias_note,
                    "status": r.status.value,
                }
                for r in rows
            ],
        }
    return {
        "provider": settings.llm_provider,
        "items": discovery_svc.suggest_candidates(payload.text, payload.origin),
    }
