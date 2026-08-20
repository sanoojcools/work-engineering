from fastapi import APIRouter, status

from ..config import settings
from ..dependencies import DbDep
from ..models.discovery import ConformanceGap, DiscoveryCandidate, IntentSource, TraceEvent
from ..schemas.common import Page
from ..schemas.discovery import (
    CandidateCreate,
    CandidateOut,
    GapCreate,
    GapOut,
    IntentCreate,
    IntentOut,
    SuggestIn,
    TraceCreate,
    TraceOut,
)
from ..services import discovery as discovery_svc

router = APIRouter()


@router.get("/traces", response_model=Page[TraceOut])
def list_traces(db: DbDep) -> Page[TraceOut]:
    rows = db.query(TraceEvent).order_by(TraceEvent.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/traces", response_model=TraceOut, status_code=status.HTTP_201_CREATED)
def create_trace(payload: TraceCreate, db: DbDep) -> TraceEvent:
    row = TraceEvent(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/intent", response_model=Page[IntentOut])
def list_intent(db: DbDep) -> Page[IntentOut]:
    rows = db.query(IntentSource).order_by(IntentSource.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/intent", response_model=IntentOut, status_code=status.HTTP_201_CREATED)
def create_intent(payload: IntentCreate, db: DbDep) -> IntentSource:
    row = IntentSource(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/candidates", response_model=Page[CandidateOut])
def list_candidates(db: DbDep) -> Page[CandidateOut]:
    rows = db.query(DiscoveryCandidate).order_by(DiscoveryCandidate.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/candidates", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
def create_candidate(payload: CandidateCreate, db: DbDep) -> DiscoveryCandidate:
    row = DiscoveryCandidate(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/gaps", response_model=Page[GapOut])
def list_gaps(db: DbDep) -> Page[GapOut]:
    rows = db.query(ConformanceGap).order_by(ConformanceGap.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/gaps", response_model=GapOut, status_code=status.HTTP_201_CREATED)
def create_gap(payload: GapCreate, db: DbDep) -> ConformanceGap:
    row = ConformanceGap(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/gaps/scan", response_model=Page[GapOut])
def scan_gaps(db: DbDep) -> Page[GapOut]:
    rows = discovery_svc.scan_gaps(db)
    return Page(total=len(rows), items=rows)


@router.post("/suggest")
def suggest(payload: SuggestIn) -> dict:
    """LLM-assisted candidates. Empty list when LLM_PROVIDER=none (import-only)."""
    return {
        "provider": settings.llm_provider,
        "items": discovery_svc.suggest_candidates(payload.text, payload.origin),
    }
