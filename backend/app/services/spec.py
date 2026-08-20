"""G6: governance by construction. Execution systems must be refused without tokens."""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.execution import CheckType, SpecCheck, SpecCheckResult
from ..models.workunit import WorkUnit


def enforce(
    db: Session,
    wu: WorkUnit,
    check_type: CheckType,
    *,
    caller: str,
    approver: str = "",
    actor: str = "",
    evidence_ref: str = "",
    object_state: str = "",
) -> SpecCheck:
    allowed = True
    reasons: list[str] = []

    if check_type == CheckType.authority:
        required = wu.authority.strip()
        if required and (not approver.strip() or required.lower() not in approver.lower()):
            allowed = False
            reasons.append(f"authority '{required}' not presented")
        if wu.actor_constraints.strip() and actor.strip():
            constraints = wu.actor_constraints.lower()
            if actor.lower() not in constraints and constraints not in actor.lower():
                allowed = False
                reasons.append(f"actor '{actor}' outside constraints")
        if wu.autonomy_level <= 2 and not approver.strip():
            allowed = False
            reasons.append("L1/L2 units require a human approver token")

    elif check_type == CheckType.evidence:
        if wu.evidence_required.strip() and not evidence_ref.strip():
            allowed = False
            reasons.append("evidence_ref required by contract")

    elif check_type == CheckType.condition:
        if object_state.strip() and object_state.strip().lower() != wu.current_condition.strip().lower():
            allowed = False
            reasons.append(
                f"object_state '{object_state}' is not pre-state '{wu.current_condition}'"
            )
        if not object_state.strip():
            allowed = False
            reasons.append("object_state required for condition check")

    elif check_type == CheckType.acceptance:
        if object_state.strip().lower() != wu.desired_condition.strip().lower():
            allowed = False
            reasons.append(
                f"object_state '{object_state}' is not desired condition '{wu.desired_condition}'"
            )

    row = SpecCheck(
        work_unit_id=wu.id,
        check_type=check_type,
        result=SpecCheckResult.allowed if allowed else SpecCheckResult.denied,
        reason="; ".join(reasons),
        caller=caller,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
