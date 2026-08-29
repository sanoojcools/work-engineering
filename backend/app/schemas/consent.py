from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ConsentReceiptCreate(BaseModel):
    subject_id: str = Field(min_length=1, max_length=200)  # maps to ConsentReceipt.interview_ref
    purpose: str = Field(min_length=1)
    data_principal_initials: str = ""  # scrubbed, never a full name
    consent_text: str = ""
    retention_days: int = 90


class ConsentReceiptOut(BaseModel):
    id: int
    subject_id: str
    purpose: str
    consented_at: datetime
    expires_at: datetime | None
    status: str
    revoked_at: datetime | None = None
    purged_at: datetime | None = None


class ConsentRevokeIn(BaseModel):
    withdrawal_method: str = ""
