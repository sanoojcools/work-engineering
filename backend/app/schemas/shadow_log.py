"""MANDATE-4 (docs/contracts/mandate-4-shadow.md): shadow_logs wire shapes.
See services/shadow_log.py for the cap-5 and duration-range rules."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ShadowLogCreateIn(BaseModel):
    occurred_at: datetime
    duration_minutes: int | None = Field(default=None, ge=1, le=480)
    note: str = Field(default="", max_length=240)


class ShadowLogOut(BaseModel):
    id: int
    work_unit_id: int
    occurred_at: datetime
    duration_minutes: int | None
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ShadowSummaryOut(BaseModel):
    count: int
    last_five: list[ShadowLogOut]
    # Hard invariants (docs/HONESTY.md): this is NOT an Observed system log.
    # Always these two literal values -- never "stated"/"defended"/"61.8".
    label: str = "self_reported"
    confidence: str = "low"
    duration_minutes_sum: int | None
