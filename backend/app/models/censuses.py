"""V10-1 BACKEND (docs/V10_BUILD.md): censuses table. One row per Work
Census a tenant has started against one Work System -- get-or-create by
(client_id, work_system_id), same shape as WorkSystem's own (client_id,
code) uniqueness (models/work_system.py). `scope` and `document_requests`
are opaque JSON blobs the API accepts and returns verbatim -- a future
Cursor UI decides their shape; this slice never interprets either column.
Readiness (consent / people / docs) is computed live from three EXISTING
tables (consent_receipts, scout_interview_sessions, uploaded_files) in
services/censuses.py, never stored here and never a fabricated
document-received workflow (V10_BUILD.md: "do not fake received files").

Text, not native JSON/JSONB, for scope/document_requests -- same convention
as ScoutInterviewSession.timeline_json: SQLite (the fast, non-RLS test
suite's DB) can't compile a Postgres JSONB column."""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CensusStatus(str, enum.Enum):
    draft = "draft"
    started = "started"


class Census(Base):
    __tablename__ = "censuses"
    __table_args__ = (
        UniqueConstraint("client_id", "work_system_id", name="uq_censuses_client_work_system"),
        Index("ix_censuses_client", "client_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    work_system_id: Mapped[int] = mapped_column(ForeignKey("work_systems.id"))
    status: Mapped[CensusStatus] = mapped_column(Enum(CensusStatus), default=CensusStatus.draft)
    scope: Mapped[str] = mapped_column(Text, default="{}")
    document_requests: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client: Mapped["Client"] = relationship()
    work_system: Mapped["WorkSystem"] = relationship()
