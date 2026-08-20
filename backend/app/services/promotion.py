"""G4: promotion is a human decision; demotion is automatic."""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..config import settings
from ..models.verification import AutonomyChange, ChangeKind, VerificationOutcome, VerificationRun
from ..models.workunit import WorkUnit
from .errors import RuleError


def pass_rate(db: Session, work_unit_id: int, limit: int = 20) -> tuple[float | None, int, int]:
    rows = (
        db.query(VerificationRun)
        .filter(VerificationRun.work_unit_id == work_unit_id)
        .order_by(VerificationRun.id.desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return None, 0, 0
    passed = sum(1 for r in rows if r.outcome == VerificationOutcome.passed)
    return passed / len(rows), passed, len(rows)


def promote(db: Session, wu: WorkUnit, to_level: int, approved_by: str, reason: str) -> AutonomyChange:
    if not approved_by.strip():
        raise RuleError("Promotion requires a human approver (G4)")
    if to_level != wu.autonomy_level + 1:
        raise RuleError("Promotion moves one level at a time")
    if to_level > 6 or to_level < 1:
        raise RuleError("Autonomy level must be 1–6")
    recommended = wu.verdict.recommended_level if wu.verdict else 1
    if to_level > recommended:
        raise RuleError(f"Cannot promote above VERDICT recommendation ({recommended})")
    rate, _passed, n = pass_rate(db, wu.id)
    if n < settings.promotion_min_runs:
        raise RuleError(
            f"Promotion needs {settings.promotion_min_runs} verification runs; have {n}"
        )
    if rate is None or rate < settings.promotion_min_pass_rate:
        raise RuleError(
            f"Pass rate {rate:.2%} is below {settings.promotion_min_pass_rate:.0%} (G4)"
        )
    return _record(db, wu, ChangeKind.promotion, to_level, reason, approved_by)


def demote(db: Session, wu: WorkUnit, to_level: int, reason: str) -> AutonomyChange:
    if to_level < 1 or to_level >= wu.autonomy_level:
        raise RuleError("Demotion must lower the current autonomy level")
    return _record(db, wu, ChangeKind.demotion, to_level, reason, approved_by="")


def maybe_autodemote(db: Session, wu: WorkUnit) -> AutonomyChange | None:
    """Automatic demotion on verification failure-rate breach (G4)."""
    if wu.autonomy_level <= 1:
        return None
    rate, _passed, n = pass_rate(db, wu.id)
    if n < 3 or rate is None:
        return None
    fail_rate = 1.0 - rate
    if fail_rate < settings.demotion_fail_rate:
        return None
    return demote(
        db,
        wu,
        wu.autonomy_level - 1,
        reason=f"Automatic demotion: fail rate {fail_rate:.0%} ≥ {settings.demotion_fail_rate:.0%}",
    )


def maybe_demote_to_recommendation(db: Session, wu: WorkUnit) -> AutonomyChange | None:
    """When VERDICT gates drop the cap below the authorised level, demote automatically."""
    if not wu.verdict:
        return None
    recommended = wu.verdict.recommended_level
    if recommended >= wu.autonomy_level:
        return None
    return demote(
        db,
        wu,
        recommended,
        reason=f"Automatic demotion to VERDICT cap L{recommended} (gates {wu.verdict.applied_gates})",
    )


def _record(
    db: Session,
    wu: WorkUnit,
    kind: ChangeKind,
    to_level: int,
    reason: str,
    approved_by: str,
) -> AutonomyChange:
    change = AutonomyChange(
        work_unit_id=wu.id,
        kind=kind,
        from_level=wu.autonomy_level,
        to_level=to_level,
        reason=reason,
        approved_by=approved_by,
    )
    wu.autonomy_level = to_level
    db.add(change)
    db.commit()
    db.refresh(change)
    db.refresh(wu)
    return change
