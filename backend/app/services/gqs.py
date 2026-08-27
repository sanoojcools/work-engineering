"""Genome Quality Score — runs against the RAW uploaded payload (a dict, not
the strict Pydantic model) on purpose: the whole point of GQS<90 blocking is
to score a genome that may still have schema violations and explain WHY it
failed, not to reject it silently at parse time before a reason can be shown.

GQS = Observed% * 0.4 + Completeness% * 0.2 + ZeroOrphan * 10
    + ZeroViolations * 10 + Kappa * 10 + ProvenanceStructured% * 0.1

Formula and weights per AMBITIOUS-IMPORT-PATH-V0-6.md Day 3-4 (matches
Scout-WEP-Master-Build-Plan-VC-CHRO-Ready.md's independent 40/20/10/10/10/10
breakdown too — the two source docs agree on this one).
"""
from __future__ import annotations

from typing import Any

REQUIRED_18 = [
    "id", "name", "business_object", "current_condition", "desired_condition",
    "context", "trigger", "input", "authority", "actor_constraints",
    "acceptance_criteria", "evidence_required", "verification_method",
    "sla_timing", "dependencies", "failure_semantics",
    "regulatory_register_link", "provenance",
]

GATE_PASS_THRESHOLD = 90.0


def _is_structured_provenance(value: Any) -> bool:
    return isinstance(value, dict) and {"file_id", "source_type"} & set(value.keys()) != set()


def _is_structured_sla(value: Any) -> bool:
    return isinstance(value, dict)


def _is_rr_array(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(v, str) for v in value)


def _wu_is_complete(wu: dict) -> bool:
    """All 18 attrs present, non-empty, and in their structured shape."""
    for attr in REQUIRED_18:
        if attr not in wu or wu[attr] in (None, "", [], {}):
            return False
    if not _is_structured_provenance(wu["provenance"]):
        return False
    if not _is_structured_sla(wu["sla_timing"]):
        return False
    if not _is_rr_array(wu["regulatory_register_link"]):
        return False
    if not isinstance(wu["input"], list):
        return False
    if not isinstance(wu["dependencies"], list):
        return False
    return True


def _wu_is_observed(wu: dict) -> bool:
    """Semantic check, deliberately separate from _is_structured_provenance:
    a genome authored before the structured-provenance fix still says
    'Observed - <source>' in plain English, and that fact should count once
    (here), not be re-penalized under Observed% just because it's also
    penalized under ProvenanceStructured% and ZeroViolations for being a
    string instead of an object."""
    prov = wu.get("provenance")
    if isinstance(prov, dict):
        return str(prov.get("source_type", "")).lower() == "observed"
    if isinstance(prov, str):
        return prov.strip().lower().startswith("observed")
    return False


def detect_schema_violations(genome: dict) -> list[dict]:
    """The 6 violations from the P0 checklist, detected on the raw payload."""
    violations: list[dict] = []
    work_units = genome.get("work_units", [])
    ids = {wu.get("id") for wu in work_units if isinstance(wu, dict)}

    if "org" in genome:
        violations.append({
            "code": "hardcoded_org",
            "detail": f"top-level 'org' field is a hardcoded name ({genome.get('org')!r}); use org_id (UUID/client_id) instead",
        })

    if "total_work_units" in genome:
        declared = genome.get("total_work_units")
        actual = len(work_units)
        if declared != actual:
            violations.append({
                "code": "derived_field_drift",
                "detail": f"total_work_units={declared} does not match actual work_units count={actual}; this field must be derived, not stored",
            })
        else:
            violations.append({
                "code": "stored_derived_field",
                "detail": "total_work_units is stored instead of derived at read time",
            })

    for wu in work_units:
        if not isinstance(wu, dict):
            continue
        wu_id = wu.get("id", "?")
        if "variant" in wu:
            violations.append({
                "code": "extra_field_variant",
                "detail": f"{wu_id}: 'variant' is not one of the 18 attributes; move into context.variants[]",
            })
        prov = wu.get("provenance")
        if isinstance(prov, str):
            violations.append({
                "code": "unstructured_provenance",
                "detail": f"{wu_id}: provenance is a free-text string ({prov!r}); must be a structured object (file_id, row, hash_sha256, timestamp, source_type, ...)",
            })
        rr = wu.get("regulatory_register_link")
        if isinstance(rr, str):
            violations.append({
                "code": "free_text_regulatory_link",
                "detail": f"{wu_id}: regulatory_register_link is free text ({rr!r}); must be an array of RR IDs",
            })
        deps = wu.get("dependencies")
        # dependencies may be a clean array (target shape) or, in a raw/
        # violation-laden upload, one free-text string ("Depends on X,
        # Blocks Y") — iterating a str directly would walk it character by
        # character, so normalize to a list of entries first.
        dep_entries = deps if isinstance(deps, list) else ([deps] if isinstance(deps, str) else [])
        for dep in dep_entries:
            dep_text = dep if isinstance(dep, str) else str(dep)
            # Only flag an actual WU-ID-looking token that isn't in this file.
            for token in dep_text.replace(",", " ").split():
                if token.startswith("WU-") and token not in ids:
                    violations.append({
                        "code": "orphan_dependency",
                        "detail": f"{wu_id}: dependency '{token}' does not exist in this genome's work_units",
                    })

    return violations


def compute_gqs(genome: dict, kappa: float | None = None) -> dict:
    work_units = genome.get("work_units", [])
    n = len(work_units)
    violations = detect_schema_violations(genome)

    observed_pct = (sum(1 for wu in work_units if _wu_is_observed(wu)) / n * 100) if n else 0.0
    completeness_pct = (sum(1 for wu in work_units if _wu_is_complete(wu)) / n * 100) if n else 0.0
    provenance_structured_pct = (
        sum(1 for wu in work_units if _is_structured_provenance(wu.get("provenance"))) / n * 100
    ) if n else 0.0

    has_orphan = any(v["code"] == "orphan_dependency" for v in violations)
    zero_orphan = 0 if has_orphan else 1

    zero_violations = 1 if not violations else 0
    kappa_pass = 1 if (kappa is not None and kappa > 0.8) else 0

    score = (
        observed_pct * 0.4
        + completeness_pct * 0.2
        + zero_orphan * 10
        + zero_violations * 10
        + kappa_pass * 10
        + provenance_structured_pct * 0.1
    )

    return {
        "gqs": round(score, 2),
        "passes_gate": score >= GATE_PASS_THRESHOLD,
        "gate_threshold": GATE_PASS_THRESHOLD,
        "breakdown": {
            "observed_pct": round(observed_pct, 2),
            "observed_contribution": round(observed_pct * 0.4, 2),
            "completeness_pct": round(completeness_pct, 2),
            "completeness_contribution": round(completeness_pct * 0.2, 2),
            "zero_orphan": bool(zero_orphan),
            "zero_orphan_contribution": zero_orphan * 10,
            "zero_violations": bool(zero_violations),
            "zero_violations_contribution": zero_violations * 10,
            "kappa": kappa,
            "kappa_pass": bool(kappa_pass),
            "kappa_contribution": kappa_pass * 10,
            "provenance_structured_pct": round(provenance_structured_pct, 2),
            "provenance_structured_contribution": round(provenance_structured_pct * 0.1, 2),
        },
        "violations": violations,
        "work_unit_count": n,
    }
