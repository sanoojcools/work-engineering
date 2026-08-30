"""P0-5: JSON schema validation for the Scout -> WEP genome handoff.

This is deliberately stricter than schemas/workunit.py's WorkUnitCreate —
extra="forbid" everywhere so an unknown field (the 'variant' violation from
the P0 checklist) is rejected outright, not silently accepted. compute_gqs()
in services/gqs.py runs BEFORE this model on the raw dict, so a genome that
fails structurally gets a GQS score and a violation list; a genome that
passes GQS but somehow still fails this model gets a 422 with the exact
field path, not a generic rejection.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ProvenanceIn(BaseModel):
    model_config = {"extra": "forbid"}

    source_type: str = Field(pattern="^(observed|declared|inferred|designed)$")
    file_id: str | None = None
    row: int | None = None
    col: str | None = None
    hash_sha256: str | None = None
    timestamp: str | None = None
    interview_id: str | None = None
    consent_receipt_id: str | None = None
    notes: str = ""


class ContextIn(BaseModel):
    model_config = {"extra": "forbid"}

    decision_branches: str = ""
    variants: list[str] = Field(default_factory=list)


class SlaTimingIn(BaseModel):
    model_config = {"extra": "forbid"}

    time_per_case_min: float | None = None
    frequency: str | None = None
    volume_per_month: int | None = None
    sla_deadline: str | None = None
    raw: str | None = None  # fallback for SLA text not yet parsed by Parser v2


class WorkUnitImport(BaseModel):
    """The 18 E3 attributes. Field names follow the wire contract (snake
    case matching Scout's JSON), not workunit.py's DB column names —
    services/genome_import.py maps between the two."""
    model_config = {"extra": "forbid"}

    id: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    business_object: str = Field(min_length=1)
    current_condition: str = Field(min_length=1)
    desired_condition: str = Field(min_length=1)
    context: ContextIn
    trigger: str = Field(min_length=1)
    input: list[str] = Field(min_length=1)
    authority: str = Field(min_length=1)
    actor_constraints: str = Field(min_length=1)
    acceptance_criteria: list[str] = Field(min_length=1)
    evidence_required: list[str] = Field(min_length=1)
    verification_method: str = Field(min_length=1)
    sla_timing: SlaTimingIn
    dependencies: list[str] = Field(default_factory=list)
    failure_semantics: str = Field(min_length=1)
    regulatory_register_link: list[str] = Field(default_factory=list)
    provenance: ProvenanceIn
    verdict: dict[str, int | str] | None = None  # optional V,E,R,D,I,C,T + autonomy passthrough


class GenomeImportRequest(BaseModel):
    """Top-level container is deliberately permissive (extra='ignore') —
    Scout's export bundles informational metadata (source_files, version,
    automation_index) alongside work_units. The P0 'no extra fields'
    violation this schema exists to catch is per-WorkUnit (the 'variant'
    field on each unit), which is why WorkUnitImport above stays strict."""
    model_config = {"extra": "ignore"}

    function_pack: str = "hr_operations"
    work_units: list[WorkUnitImport] = Field(min_length=1)
    work_graph_edges: list[dict] = Field(default_factory=list)
    dual_scoring_kappa: float | None = None
