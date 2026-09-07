from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ModerationEntryIn(BaseModel):
    """'Moving S2 toward S3 requires reason + name' -- both enforced here,
    not only greyed out client-side. work_unit_code is free text checked
    against this tenant's real Work Units by the router (404 if it doesn't
    exist), not a foreign key -- moderation_entries outlives a Work Unit
    that's later re-imported under the same code, same reasoning AuditLog
    already uses (resource_id as a string, not a hard FK)."""

    work_unit_code: str = Field(min_length=1, max_length=40)
    from_level: int = Field(ge=1, le=6)
    to_level: int = Field(ge=1, le=6)
    reason: str = Field(min_length=1, max_length=2000)
    moderated_by: str = Field(min_length=1, max_length=120)


class ModerationEntryOut(BaseModel):
    id: int
    work_unit_code: str
    from_level: int
    to_level: int
    reason: str
    moderated_by: str
    created_at: datetime
