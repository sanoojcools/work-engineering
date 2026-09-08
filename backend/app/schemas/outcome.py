"""V10-5 outcome record wire shapes. `OutcomeMeasureIn` is deliberately two
required fields, not one free-text blob: "measured only with a real number
+ source else 422" (docs/NEXT.md) is enforced as two separately-checked
values (services/outcome.py) rather than pattern-guessing at a single
string for both a number and a citation."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models.outcome import OutcomeStatus


class OutcomeOut(BaseModel):
    id: int
    work_system_id: int
    promised: str
    measured: str | None
    status: OutcomeStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OutcomeMeasureIn(BaseModel):
    measured: str = Field(min_length=1)
    source: str = Field(min_length=1)
