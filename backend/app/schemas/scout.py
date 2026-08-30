from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    type: str = Field(pattern="^(founder|sme)$")
    interviewee_name: str = Field(min_length=1, max_length=160)
    consent_receipt_id: int | None = None


class UnitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    inputs: str = ""
    outputs: str = ""
    systems: str = ""
    frequency: str = ""
    time_minutes: float | None = None
    pain: str = ""
    handoffs: str = ""
    decision_rule: str = ""


class UnitUpdate(BaseModel):
    name: str | None = None
    inputs: str | None = None
    outputs: str | None = None
    systems: str | None = None
    frequency: str | None = None
    time_minutes: float | None = None
    pain: str | None = None
    handoffs: str | None = None
    decision_rule: str | None = None


class UnitOut(BaseModel):
    id: int
    name: str
    inputs: str
    outputs: str
    systems: str
    frequency: str
    time_minutes: float | None
    pain: str
    handoffs: str
    decision_rule: str
    created_at: datetime
    updated_at: datetime


class DimensionOut(BaseModel):
    key: str
    label: str
    captured: int
    expected: int
    pct: float
    computed: bool = True


class SessionOut(BaseModel):
    id: int
    type: str
    interviewee_name: str
    status: str
    completeness_pct: float
    consent_receipt_id: int | None
    dimensions: list[DimensionOut]
    units: list[UnitOut]
    created_at: datetime
    updated_at: datetime
