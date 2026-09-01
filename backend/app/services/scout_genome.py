"""Elevation 5 payoff: "Generate V8 Work Units" calls the EXISTING genome
import pipeline (services/genome_import.import_genome) -- no parallel
write path. This is a best-effort, lossy mapping: the Work Capture Grid
(PR1) never collected several of the 18 required attributes (trigger,
actor_constraints, acceptance_criteria, evidence_required,
failure_semantics), because no screen in this PR asks for them directly.
Rather than fabricate specific-sounding content for those fields, each
uses one honest, literal placeholder string -- so a genome built from a
thin Scout session scores LOW on GQS (repeated placeholder text fails
completeness/quality checks) and a genome built from a thorough one
scores however it genuinely scores. This is deliberate: the gate should
see the same gaps a human reviewer would, not a genome dressed up to
look more complete than the interview actually was.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.scout import ScoutCapturedUnit, ScoutInterviewSession
from .genome_import import import_genome

NOT_CAPTURED = "Not captured in Scout interview -- needs a follow-up question."


def _wu_id(unit: ScoutCapturedUnit) -> str:
    return f"WU-SCOUT-{unit.id}"[:40]


def unit_to_work_unit_import(unit: ScoutCapturedUnit, interviewee_name: str, consent_receipt_id: int | None) -> dict:
    return {
        "id": _wu_id(unit),
        "name": unit.name[:200] or f"Unit {unit.id}",
        # Scout never asked "business object" as its own question in PR1 --
        # the captured unit name IS the closest thing to one today.
        "business_object": unit.name[:200] or f"Unit {unit.id}",
        "current_condition": (unit.inputs or NOT_CAPTURED)[:80],
        "desired_condition": (unit.outputs or NOT_CAPTURED)[:80],
        "context": {"decision_branches": unit.decision_rule, "variants": []},
        "trigger": f"Occurs {unit.frequency}" if unit.frequency else NOT_CAPTURED,
        "input": [s.strip() for s in unit.inputs.split(",") if s.strip()] or [NOT_CAPTURED],
        "authority": interviewee_name or NOT_CAPTURED,
        "actor_constraints": interviewee_name or NOT_CAPTURED,
        "acceptance_criteria": [unit.decision_rule] if unit.decision_rule.strip() else [NOT_CAPTURED],
        "evidence_required": [s.strip() for s in unit.outputs.split(",") if s.strip()] or [NOT_CAPTURED],
        "verification_method": "human_spot_check",  # same default fallback as the existing text-to-enum heuristic
        "sla_timing": {
            "time_per_case_min": unit.time_minutes,
            "frequency": unit.frequency or None,
            "volume_per_month": None,
            "sla_deadline": None,
            "raw": None,
        },
        "dependencies": [],
        "failure_semantics": unit.pain or NOT_CAPTURED,
        "regulatory_register_link": [],
        "provenance": {
            # "declared": self-reported in a structured interview, not a
            # document Scout parsed -- distinct from "observed" on purpose.
            "source_type": "declared",
            "notes": f"Scout Elevated V2 session, captured unit {unit.id}",
            # Marks this unit as interview-sourced, which is what
            # genome_import.py's _validate_consent gates on -- see that
            # function's docstring. A document-sourced import (JSON-body,
            # no interview involved) never sets this and is unaffected.
            "interview_id": f"scout-session-{unit.session_id}",
            "consent_receipt_id": str(consent_receipt_id) if consent_receipt_id else None,
        },
    }


def build_genome_payload(session: ScoutInterviewSession) -> dict:
    return {
        "work_units": [
            unit_to_work_unit_import(u, session.interviewee_name, session.consent_receipt_id)
            for u in session.units
        ],
    }


def generate_genome(db: Session, session: ScoutInterviewSession, *, actor: str) -> dict:
    payload = build_genome_payload(session)
    # enforce_consent=True: this is the one real live path a Scout session's
    # own consent_receipt_id can be checked against -- see
    # genome_import.py::_validate_consent's docstring for why the generic
    # JSON-body import stays permissive instead.
    return import_genome(db, session.client_id, payload, actor=actor, enforce_consent=True)
