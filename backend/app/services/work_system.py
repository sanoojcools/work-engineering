from __future__ import annotations

from datetime import datetime

from ..models.work_system import WorkSystem
from ..schemas.work_system import IntentOut, WorkSystemOut


def _intent_status(confirmed_at: datetime | None) -> str:
    return "confirmed" if confirmed_at is not None else "draft"


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
        function_intent=IntentOut(
            label=ws.function_intent_outcome,
            owner=ws.function_intent_owner,
            measure=ws.function_intent_measure or "not stated",
            status=_intent_status(ws.function_intent_confirmed_at),
            confirmed_by=ws.function_intent_confirmed_by,
            confirmed_at=ws.function_intent_confirmed_at,
        ),
        work_system_intent=IntentOut(
            label=ws.work_system_intent_purpose,
            owner=ws.work_system_intent_owner,
            measure=None,
            status=_intent_status(ws.work_system_intent_confirmed_at),
            confirmed_by=ws.work_system_intent_confirmed_by,
            confirmed_at=ws.work_system_intent_confirmed_at,
        ),
    )
