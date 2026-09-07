"""V10-2 (docs/V10_BUILD.md): field pointer wire shapes. See
services/pointers.py for what the resolver actually checks."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from ..models.pointers import PointerStatus


class FieldPointerIn(BaseModel):
    field_name: str = Field(min_length=1, max_length=60)
    status: PointerStatus
    file_id: int | None = None
    page: int | None = None
    line: int | None = None
    cell: str | None = None
    quote: str = ""


class FieldPointerOut(BaseModel):
    id: int
    work_unit_id: int
    field_name: str
    # What the caller claimed vs. what the resolver actually let stand --
    # they diverge exactly when a broken pointer downgraded the claim.
    requested_status: PointerStatus
    status: PointerStatus
    file_id: int | None
    page: int | None
    line: int | None
    cell: str | None
    quote: str
    resolved: bool
    resolution_note: str
    gap_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
