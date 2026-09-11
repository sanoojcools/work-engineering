"""V10-11 (docs/contracts/v10-11-states.md): admissibility for the one
Work System journey (Offer Desk -> Onboarding). Reuses
work_system.py::desk_of for "this journey" membership -- there is no FK
from work_units to work_systems, and this contract explicitly refuses a
second graph table.

A unit is inadmissible if:
  1. no_exit -- desired_condition is non-empty and no work unit of the
     same client + same business_object has that string as
     current_condition. Same idea as Gate 9 (genome_import.py's
     _flag_missing_terminal_state), but per-unit and refuses handoff
     rather than warning on import.
  2. two_owners -- owner contains "," or " and " (case-insensitive).
  3. unaffordable_check -- evidence_required is non-blank (the closest
     honest reading of "true" against this column's actual Text type --
     see models/workunit.py, there is no boolean evidence_required) and
     sla_hours is null or <= 0.

This module is the single source of truth for both
GET /work-systems/{id}/admissibility and the handoff 422 gate
(services/handoff.py) -- both must report the same reason for the same
unit, so both call refusals_for_unit() rather than duplicating the rule.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..models.workunit import WorkUnit
from .work_system import desk_of


@dataclass
class Refusal:
    work_unit_id: int
    code: str
    reason: str
    detail: str


def _has_two_owners(owner: str) -> bool:
    return "," in owner or " and " in owner.lower()


def _unaffordable_check(wu: WorkUnit) -> bool:
    return bool(wu.evidence_required.strip()) and (wu.sla_hours is None or wu.sla_hours <= 0)


def _no_exit_detail(db: Session, wu: WorkUnit) -> str | None:
    desired = (wu.desired_condition or "").strip()
    if not desired:
        return None
    exists = (
        db.query(WorkUnit.id)
        .filter(
            WorkUnit.client_id == wu.client_id,
            WorkUnit.business_object_type_id == wu.business_object_type_id,
            WorkUnit.current_condition == desired,
        )
        .first()
    )
    if exists is not None:
        return None
    return f"No work unit's current_condition is '{desired}' for this business object."


def refusals_for_unit(db: Session, wu: WorkUnit) -> list[Refusal]:
    refusals: list[Refusal] = []
    no_exit_detail = _no_exit_detail(db, wu)
    if no_exit_detail is not None:
        refusals.append(Refusal(wu.id, wu.code, "no_exit", no_exit_detail))
    if _has_two_owners(wu.owner or ""):
        refusals.append(Refusal(wu.id, wu.code, "two_owners", f"owner='{wu.owner}' names more than one human."))
    if _unaffordable_check(wu):
        refusals.append(Refusal(
            wu.id, wu.code, "unaffordable_check",
            "evidence_required is stated but sla_hours is null or <= 0 -- a check with no hours we will defend.",
        ))
    return refusals


def journey_units(db: Session, client_id: int) -> list[WorkUnit]:
    rows = db.query(WorkUnit).filter(WorkUnit.client_id == client_id).all()
    return [wu for wu in rows if desk_of(wu.code) is not None]


def check(db: Session, client_id: int) -> list[Refusal]:
    refusals: list[Refusal] = []
    for wu in journey_units(db, client_id):
        refusals.extend(refusals_for_unit(db, wu))
    return refusals
