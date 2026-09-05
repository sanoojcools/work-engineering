from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    type: str = Field(pattern="^(function_head|sub_function_lead|sme)$")
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


class BlastRadiusItemOut(BaseModel):
    key: str
    name: str
    cluster: str
    in_scope: bool
    owner_name: str
    priority: str


class BlastRadiusSummaryOut(BaseModel):
    total_sub_functions: int
    selected_count: int
    selected_pct: float
    total_clusters: int
    clusters_touched: int


class BlastRadiusOut(BaseModel):
    items: list[BlastRadiusItemOut]
    summary: BlastRadiusSummaryOut


class BlastRadiusSelectionUpdate(BaseModel):
    in_scope: bool | None = None
    owner_name: str | None = Field(default=None, max_length=160)
    # "" clears a previously set priority -- distinct from omitting the
    # field (which leaves it unchanged, via exclude_unset in the router).
    priority: str | None = Field(default=None, pattern="^(P0|P1|)$")


class PersistTalkOnlyIn(BaseModel):
    """sheet_attached = the workbook is a declared interview note, not traces."""
    sheet_attached: bool = False


class PersistTalkOnlyOut(BaseModel):
    model_config = ConfigDict(extra="allow")

    accepted: bool
    saved_count: int
    work_unit_count: int
    gqs: float
    reasons: list[str]
    talk_only: bool
    sheet_attached: bool
    provenance: str
    ratification_accepted: bool
    zwayam_events_claimed: int
    version_id: int
    sequence: int
    violations: list[dict] = Field(default_factory=list)


class GenerateGenomeOut(BaseModel):
    # Passes through import_genome()'s real result dict as-is (accepted,
    # version_id, gqs, gate_threshold, breakdown, violations,
    # work_unit_count, work_graph_edge_count on success) -- same GQS gate
    # as every other import path, not a relaxed one for Scout-originated
    # genomes.
    model_config = ConfigDict(extra="allow")

    accepted: bool
    version_id: int
    # Tenant-scoped version number, distinct from the global version_id key.
    sequence: int
    gqs: float
    work_unit_count: int
    violations: list[dict] = Field(default_factory=list)
