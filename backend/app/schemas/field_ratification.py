"""V10-8 (docs/contracts/v10-8-field-ratify.md): field ratify + decision
card wire shapes. See services/field_ratification.py for what the quote
rule and confirm/correct actually check."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from ..models.field_ratification import FieldRatificationField


class FieldRatificationCreateIn(BaseModel):
    field_name: FieldRatificationField
    sitting_quote: str = Field(min_length=8)
    drafted_value: str = Field(min_length=1)


class FieldRatificationConfirmIn(BaseModel):
    action: Literal["confirm", "correct"]
    confirmed_by: str = Field(min_length=1, max_length=120)
    # Required for "correct"; ignored for "confirm" (drafted_value is copied
    # over instead). Enforced in the service, not here, so the 422 reason is
    # specific ("value required for correct") rather than a generic schema error.
    value: str | None = None


class FieldRatificationOut(BaseModel):
    id: int
    work_unit_id: int
    field_name: FieldRatificationField
    sitting_quote: str
    drafted_value: str
    confirmed_value: str | None
    status: str
    confirmed_by: str | None
    confirmed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DecisionCardOut(BaseModel):
    gap_id: int
    kind: str
    description: str
    named_human: str
    action: Literal["confirm_or_correct"] = "confirm_or_correct"
