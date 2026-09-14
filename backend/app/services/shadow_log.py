"""MANDATE-4 (docs/contracts/mandate-4-shadow.md): in-app self-reported
finish times for one piece of work -- no Slack, no Workday, no Clerk.

Hard invariants (verbatim from the contract): these rows are NOT Observed
system logs; nothing here ever writes into stated/defended/95/61.8
(services/simulator.py's STATED_HOURS_MO / DEFENDED_HOURS_MO); logging a
time on a dual-employment piece never lifts the stop
(services/handoff.py's DUAL_EMPLOYMENT_STOP_CODES) -- this module never
touches handoff readiness at all."""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.security import AuditLog
from ..models.shadow_log import ShadowLog
from ..models.workunit import WorkUnit

# Cap: a shadow log is a lightweight signal, never a second system of
# record -- the 6th row for a unit is refused, not silently accepted.
MAX_ROWS_PER_UNIT = 5


def list_for_unit(db: Session, work_unit_id: int) -> list[ShadowLog]:
    return (
        db.query(ShadowLog)
        .filter(ShadowLog.work_unit_id == work_unit_id)
        .order_by(ShadowLog.occurred_at.desc())
        .all()
    )


def create_log(
    db: Session,
    work_unit: WorkUnit,
    key,
    *,
    occurred_at,
    duration_minutes: int | None,
    note: str,
) -> ShadowLog:
    existing = (
        db.query(ShadowLog)
        .filter(ShadowLog.work_unit_id == work_unit.id)
        .order_by(ShadowLog.occurred_at.desc())
        .all()
    )
    if len(existing) >= MAX_ROWS_PER_UNIT:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"WorkUnit {work_unit.id} already has {MAX_ROWS_PER_UNIT} shadow logs (cap reached)",
        )
    if any(row.occurred_at == occurred_at for row in existing):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A shadow log for WorkUnit {work_unit.id} at {occurred_at.isoformat()} already exists",
        )

    row = ShadowLog(
        client_id=key.client_id,
        work_unit_id=work_unit.id,
        occurred_at=occurred_at,
        duration_minutes=duration_minutes,
        note=note,
    )
    db.add(row)
    db.flush()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="shadow_log.create", resource="shadow_log", resource_id=str(row.id),
        detail=f"work_unit_id={work_unit.id} occurred_at={occurred_at.isoformat()}",
    ))
    db.commit()
    db.refresh(row)
    return row


def summary(db: Session, work_unit_id: int) -> dict:
    rows = list_for_unit(db, work_unit_id)
    last_five = rows[:MAX_ROWS_PER_UNIT]

    # "If any of the five lacks duration -> null. Do not guess, do not
    # average dates into hours." An empty set has nothing measured, so it
    # is honestly null too, not a fabricated 0.
    if last_five and all(row.duration_minutes is not None for row in last_five):
        duration_minutes_sum = sum(row.duration_minutes for row in last_five)
    else:
        duration_minutes_sum = None

    return {
        "count": len(rows),
        "last_five": last_five,
        "label": "self_reported",
        "confidence": "low",
        "duration_minutes_sum": duration_minutes_sum,
    }
