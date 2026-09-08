"""V10-5 (docs/NEXT.md): outcome-record get-or-create + validated measure.

"Never invent 62%" is enforced here, not just documented: the only write
path that can move status to `measured` requires a caller-supplied numeric
result AND a named source, or the write is rejected outright (422) and the
row stays `not_measured`.
"""
from __future__ import annotations

import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.outcome import OutcomeRecord, OutcomeStatus
from ..models.work_system import WorkSystem

_HAS_DIGIT = re.compile(r"\d")


def get_or_create(db: Session, ws: WorkSystem) -> OutcomeRecord:
    row = db.query(OutcomeRecord).filter(OutcomeRecord.work_system_id == ws.id).one_or_none()
    if row is not None:
        return row
    row = OutcomeRecord(work_system_id=ws.id, promised=ws.outcome, status=OutcomeStatus.not_measured)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def record_measurement(db: Session, ws: WorkSystem, measured: str, source: str) -> OutcomeRecord:
    measured_clean = measured.strip()
    source_clean = source.strip()
    if not _HAS_DIGIT.search(measured_clean):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "measured must state a real, numeric result -- a real number, not a description",
        )
    if not source_clean:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "measured requires a named source -- never invent a result with nothing backing it",
        )
    row = get_or_create(db, ws)
    row.measured = f"{measured_clean} (source: {source_clean})"
    row.status = OutcomeStatus.measured
    db.commit()
    db.refresh(row)
    return row
