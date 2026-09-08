from datetime import datetime

from pydantic import BaseModel, Field

from ..models.discovery import CandidateStatus, GapKind, GapTier, IntentKind, Origin, TraceKind
from ..models.ontology import Provenance


class TraceCreate(BaseModel):
    source_system: str = ""
    kind: TraceKind = TraceKind.log
    object_ref: str = ""
    payload: str = "{}"
    provenance: Provenance = Provenance.observed


class TraceOut(BaseModel):
    id: int
    source_system: str
    kind: TraceKind
    object_ref: str
    payload: str
    imported_at: datetime
    provenance: Provenance

    model_config = {"from_attributes": True}


class IntentCreate(BaseModel):
    kind: IntentKind = IntentKind.sop
    title: str
    body: str = ""
    provenance: Provenance = Provenance.declared
    client_id: int | None = None


class IntentOut(BaseModel):
    id: int
    kind: IntentKind
    title: str
    body: str
    provenance: Provenance
    client_id: int | None = None

    model_config = {"from_attributes": True}


class CandidateCreate(BaseModel):
    name: str
    origin: Origin = Origin.upward
    provenance: Provenance = Provenance.inferred
    payload: str = "{}"
    sampling_bias_note: str = ""
    work_unit_id: int | None = None


class CandidateOut(BaseModel):
    id: int
    name: str
    origin: Origin
    provenance: Provenance
    payload: str
    sampling_bias_note: str
    status: CandidateStatus
    work_unit_id: int | None
    client_id: int | None = None

    model_config = {"from_attributes": True}


class GapCreate(BaseModel):
    kind: GapKind = GapKind.undeclared
    severity: str = "P2"
    description: str = ""
    discovered_ref: str = ""
    declared_ref: str = ""
    work_unit_id: int | None = None


class GapOut(BaseModel):
    id: int
    kind: GapKind
    # V10-5b (docs/NEXT.md): which of the three tiers this gap sits in.
    # Read-only and derived -- GapCreate deliberately does not accept it
    # (see routers/discovery.py::create_gap), because a tier that disagreed
    # with its kind would be a lie a caller could tell.
    tier: GapTier
    severity: str
    description: str
    discovered_ref: str
    declared_ref: str
    work_unit_id: int | None
    client_id: int | None = None

    model_config = {"from_attributes": True}


class SuggestIn(BaseModel):
    text: str = Field(min_length=1)
    origin: Origin = Origin.downward
    title: str = "Intake"
    kind: IntentKind = IntentKind.job_description
    persist: bool = True
    client_id: int | None = None


class MergeIn(BaseModel):
    work_unit_id: int
