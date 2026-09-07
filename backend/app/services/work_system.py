from __future__ import annotations

from ..models.work_system import WorkSystem
from ..schemas.work_system import WorkSystemOut


def to_out(ws: WorkSystem) -> WorkSystemOut:
    return WorkSystemOut(
        id=ws.id,
        code=ws.code,
        name=ws.name,
        entry=ws.entry,
        exit=ws.exit,
        owner=ws.owner,
        outcome=ws.outcome,
        status=ws.status.value,
        ratified_by=ws.ratified_by,
        ratified_at=ws.ratified_at,
        created_at=ws.created_at,
    )
