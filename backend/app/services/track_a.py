"""Slice 1 PR 1c (playbook E.3): Track A deterministic mapper + orphan
visibility. No LLM anywhere in this module — every field is an exact
(case-insensitive) column-header match, never a guess. A row missing a
required field queues (reason=track_a_incomplete) instead of importing with
a blank required field; a file missing a required column entirely queues
the whole file (reason=track_a_missing_columns) instead of guessing which
column might mean what.

Mapped output is handed to the EXISTING GQS + import pipeline
(services.genome_import.import_genome) unchanged — this module produces a
GenomeImportRequest-shaped dict, it does not write WorkUnit rows itself.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .classifier import classify
from .genome_import import _clip

# Exact-match only (case-insensitive, stripped) — deterministic, no fuzzy
# scoring here. The Step-identity fuzzy/synonym scoring stays in
# classifier.py and is only used to find the header row.
TRACK_A_COLUMNS: dict[str, list[str]] = {
    "name": ["What happens", "What Happens", "Description"],
    "business_object": ["Business Object", "BO"],
    "current_condition": ["Current Condition", "Current"],
    "desired_condition": ["Desired Condition", "Desired"],
    "trigger": ["Trigger"],
    "decision_branches": ["Decision branches", "Decision Branches"],
    "input": ["Input", "Data fields", "Data Fields"],
    "authority": ["Authority"],
    "actor_constraints": ["Actor Constraints"],
    "acceptance_criteria": ["Acceptance Criteria"],
    "evidence_required": ["Evidence Required"],
    "verification_method": ["Verification Method"],
    "failure_semantics": ["Failure Semantics"],
    "regulatory_register_link": ["Regulatory Links", "Regulatory Register Link"],
    "dependencies": ["Dependencies", "Depends On"],
}

REQUIRED_FOR_ROW_IMPORT = (
    "name", "business_object", "current_condition", "desired_condition", "trigger",
    "input", "authority", "actor_constraints", "acceptance_criteria",
    "evidence_required", "verification_method", "failure_semantics",
)
REQUIRED_COLUMNS_ON_FILE = REQUIRED_FOR_ROW_IMPORT

RR_TOKEN_RE = re.compile(r"RR-\S+")
WU_TOKEN_RE = re.compile(r"WU-[A-Za-z0-9_-]+")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _is_substring_of(value: str, raw_text: str) -> bool:
    """Substring guardrail (playbook E.0): case-fold + whitespace-collapse
    allowed, otherwise a mapped value must literally appear in the row."""
    return _norm(value) in _norm(raw_text)


@dataclass
class TrackARowResult:
    row_index: int
    queued: bool
    reason: str = ""
    work_unit: dict | None = None


@dataclass
class TrackAResult:
    queued_whole_file: bool
    reason: str = ""
    header_row_index: int | None = None
    work_units: list[dict] = field(default_factory=list)
    queued_rows: list[TrackARowResult] = field(default_factory=list)


def _resolve_columns(header_cells: list[str]) -> dict[str, int]:
    """Maps canonical field name -> column index, exact match only."""
    normalized = {_norm(c): idx for idx, c in enumerate(header_cells)}
    resolved: dict[str, int] = {}
    for field_name, synonyms in TRACK_A_COLUMNS.items():
        for syn in synonyms:
            idx = normalized.get(_norm(syn))
            if idx is not None:
                resolved[field_name] = idx
                break
    return resolved


def map_track_a(content: bytes, file_name: str, *, uploaded_file_id: int, file_sha256: str) -> TrackAResult:
    classification = classify(content, file_name)
    if classification.queued:
        return TrackAResult(queued_whole_file=True, reason="unrecognized_step_column")

    from .classifier import _rows_from_bytes  # internal helper, not part of the public classify() API

    rows = _rows_from_bytes(content, file_name)
    header_cells = classification.header_cells
    col_map = _resolve_columns(header_cells)

    missing_columns = [f for f in REQUIRED_COLUMNS_ON_FILE if f not in col_map]
    if missing_columns:
        return TrackAResult(
            queued_whole_file=True,
            reason="track_a_missing_columns",
            header_row_index=classification.header_row_index,
        )

    step_col = classification.step_identity_column
    work_units: list[dict] = []
    queued_rows: list[TrackARowResult] = []

    for row_idx, row in enumerate(rows[classification.header_row_index + 1:], start=classification.header_row_index + 1):
        if not any((c or "").strip() for c in row):
            continue
        raw_text = ",".join(str(c) for c in row)

        def cell(field_name: str) -> str:
            idx = col_map.get(field_name)
            if idx is None or idx >= len(row):
                return ""
            return (row[idx] or "").strip()

        step_id = (row[step_col] if step_col < len(row) else "").strip()
        if not step_id:
            queued_rows.append(TrackARowResult(row_idx, True, "track_a_incomplete"))
            continue

        values = {f: cell(f) for f in REQUIRED_FOR_ROW_IMPORT}
        missing = [f for f in REQUIRED_FOR_ROW_IMPORT if not values[f]]
        if missing:
            queued_rows.append(TrackARowResult(row_idx, True, "track_a_incomplete"))
            continue

        ungrounded = [f for f, v in values.items() if not _is_substring_of(v, raw_text)]
        if ungrounded:
            queued_rows.append(TrackARowResult(row_idx, True, "ungrounded_mapping"))
            continue

        rr_links = RR_TOKEN_RE.findall(cell("regulatory_register_link"))
        dep_tokens = WU_TOKEN_RE.findall(cell("dependencies"))

        wu = {
            "id": _clip(step_id, 40),
            "name": _clip(values["name"], 200),
            "business_object": values["business_object"],
            "current_condition": _clip(values["current_condition"], 80),
            "desired_condition": _clip(values["desired_condition"], 80),
            "context": {"decision_branches": cell("decision_branches"), "variants": []},
            "trigger": values["trigger"],
            "input": [values["input"]],
            "authority": values["authority"],
            "actor_constraints": values["actor_constraints"],
            "acceptance_criteria": [values["acceptance_criteria"]],
            "evidence_required": [values["evidence_required"]],
            "verification_method": values["verification_method"],
            "sla_timing": {"raw": None},
            "dependencies": dep_tokens,
            "failure_semantics": values["failure_semantics"],
            "regulatory_register_link": rr_links,
            "provenance": {
                "source_type": "observed",
                "file_id": str(uploaded_file_id),
                "row": row_idx,
                "hash_sha256": file_sha256,
                "notes": f"Track A mapped from {file_name} row {row_idx}",
            },
        }
        work_units.append(wu)

    return TrackAResult(
        queued_whole_file=False,
        header_row_index=classification.header_row_index,
        work_units=work_units,
        queued_rows=queued_rows,
    )


def find_orphan_dependencies(work_units: list[dict]) -> list[dict]:
    """Playbook v0.7 addition: every dependencies[] entry that doesn't match
    an id in this same mapped batch is a visibility item, not a silent skip.
    Does not create an edge to the missing target either way (existing
    write behavior in genome_import.py) — this only makes the gap visible."""
    ids = {wu["id"] for wu in work_units}
    orphans: list[dict] = []
    for wu in work_units:
        for dep in wu.get("dependencies", []):
            if dep not in ids:
                orphans.append({
                    "wu_id": wu["id"],
                    "dependency_id": dep,
                    "file_id": wu["provenance"]["file_id"],
                    "row": wu["provenance"]["row"],
                })
    return orphans
