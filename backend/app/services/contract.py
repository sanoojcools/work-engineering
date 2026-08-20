"""E3: eighteen contract attributes. Missing ones = human-readable, not machine-enforceable."""
from __future__ import annotations

from ..models.workunit import WorkUnit

# Attribute 15 (dependencies) lives on the Work Graph, not as a scalar.
STRING_ATTRS = (
    ("code", 1, "ID"),
    ("name", 2, "Name"),
    ("current_condition", 4, "Current Condition"),
    ("desired_condition", 5, "Desired Condition"),
    ("context", 6, "Context"),
    ("trigger", 7, "Trigger"),
    ("inputs", 8, "Input"),
    ("authority", 9, "Authority"),
    ("actor_constraints", 10, "Actor Constraints"),
    ("acceptance_criteria", 11, "Acceptance Criteria"),
    ("evidence_required", 12, "Evidence Required"),
    ("failure_semantics", 16, "Failure Semantics"),
)


def missing_attributes(wu: WorkUnit) -> list[str]:
    missing: list[str] = []
    if not wu.business_object_type_id:
        missing.append("3 Business Object")
    for field, number, label in STRING_ATTRS:
        if not str(getattr(wu, field) or "").strip():
            missing.append(f"{number} {label}")
    if not wu.verification_method:
        missing.append("13 Verification Method")
    if wu.sla_hours is None:
        missing.append("14 SLA / Timing")
    if wu.provenance is None:
        missing.append("18 Provenance")
    return missing


def machine_readable(wu: WorkUnit) -> bool:
    return not missing_attributes(wu)


def evidence_path_exists(wu: WorkUnit) -> bool:
    return bool(str(wu.evidence_required or "").strip())
