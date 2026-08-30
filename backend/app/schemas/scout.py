from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    type: str = Field(pattern="^(founder|sme)$")
    interviewee_name: str = Field(min_length=1, max_length=160)
    consent_receipt_id: int | None = None


class UnitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    inputs: str = ""
    outputs: str = ""
    systems: str = ""
    frequency: str = ""
    time_minutes: float | None = None
    pain: str = ""
    handoffs: str = ""
    decision_rule: str = ""


class UnitUpdate(BaseModel):
    name: str | None = None
    inputs: str | None = None
    outputs: str | None = None
    systems: str | None = None
    frequency: str | None = None
    time_minutes: float | None = None
    pain: str | None = None
    handoffs: str | None = None
    decision_rule: str | None = None


class UnitOut(BaseModel):
    id: int
    name: str
    inputs: str
    outputs: str
    systems: str
    frequency: str
    time_minutes: float | None
    pain: str
    handoffs: str
    decision_rule: str
    created_at: datetime
    updated_at: datetime


class DimensionOut(BaseModel):
    key: str
    label: str
    captured: int
    expected: int
    pct: float
    computed: bool = True


class SessionOut(BaseModel):
    id: int
    type: str
    interviewee_name: str
    status: str
    completeness_pct: float
    consent_receipt_id: int | None
    dimensions: list[DimensionOut]
    units: list[UnitOut]
    created_at: datetime
    updated_at: datetime


class TimelineOut(BaseModel):
    # timeline_json is a deliberately open JSONB blob -- PATCH lets a
    # manual drag-correction add fields the deterministic builder never
    # emits (see services/scout_timeline.py), so the response model must
    # not silently drop them.
    model_config = ConfigDict(extra="allow")

    day_start_min: int
    day_end_min: int
    blocks: list[dict]
    gaps: list[dict]
    total_minutes: float
    over_allocated: bool
    unplaced_units: list[dict]


class TimelineUpdate(BaseModel):
    timeline: dict


class ContradictionOut(BaseModel):
    id: int
    unit_name: str
    field: str
    founder_session_id: int
    sme_session_id: int
    founder_text: str
    sme_text: str
    confidence: float
    resolution: str
    status: str
    created_at: datetime


class ContradictionResolve(BaseModel):
    resolution: str = Field(min_length=1)


class PainHeatmapOut(BaseModel):
    systems: list[dict]
    top_pain_points: list[dict]
    total_time_wasted_min_per_day: float


class StoryExtractIn(BaseModel):
    transcript_chunk: str = Field(min_length=1)


class StoryExtractOut(BaseModel):
    used_llm: bool
    chunks: list[dict]
    note: str


class FuturePreviewOut(BaseModel):
    completeness_pct: float
    unlocked: bool
    time_saved_min_per_day: float
    business_objects_preview: list[str]
    unit_count: int


class GenerateGenomeOut(BaseModel):
    # Passes through import_genome()'s real result dict as-is (accepted,
    # version_id, gqs, gate_threshold, breakdown, violations,
    # work_unit_count, work_graph_edge_count on success) -- same GQS gate
    # as every other import path, not a relaxed one for Scout-originated
    # genomes.
    model_config = ConfigDict(extra="allow")

    accepted: bool
    version_id: int
    gqs: float
    work_unit_count: int
    violations: list[dict] = Field(default_factory=list)
