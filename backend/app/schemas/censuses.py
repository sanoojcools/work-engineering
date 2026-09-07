from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ReadinessOut(BaseModel):
    """Three honest booleans, each computed live from an EXISTING table
    (services/censuses.py) -- never a fabricated document-received
    workflow. Counts ride along so a red strip can say why, not just that
    it's red."""

    consent: bool
    consent_receipt_count: int
    people: bool
    people_seats_filled: int
    people_seats_total: int
    docs: bool
    docs_uploaded_count: int


class CensusOut(BaseModel):
    id: int
    client_id: int
    work_system_id: int
    status: str
    scope: dict
    document_requests: list
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    readiness: ReadinessOut


class CensusEnsureIn(BaseModel):
    """Get-or-create by (tenant, work_system_id). A tenant that already has
    a census for this Work System gets that row back unchanged -- scope /
    document_requests are set once, at ensure time, and never overwritten
    by a later call (same rule WorkSystemEnsureIn's own fields follow)."""

    work_system_id: int
    scope: dict = Field(default_factory=dict)
    document_requests: list = Field(default_factory=list)
