from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class WorkSystemOut(BaseModel):
    id: int
    code: str
    name: str
    entry: str
    exit: str
    owner: str
    outcome: str
    status: str
    ratified_by: str
    ratified_at: datetime | None
    created_at: datetime


class WorkSystemEnsureIn(BaseModel):
    """Get-or-create by (tenant, code). A tenant that already has this
    journey's row gets that row back unchanged -- this never overwrites a
    ratified row's fields with a guest-computed default on a later call."""
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    entry: str = ""
    exit: str = ""
    owner: str = ""
    outcome: str = ""


class WorkSystemRatifyIn(BaseModel):
    ratified_by: str = Field(min_length=1, max_length=120)
