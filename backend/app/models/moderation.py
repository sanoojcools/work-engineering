"""E -- PLAN, moderation log (docs/BUILD_PROGRAM.md). "Moving S2 toward S3
requires reason + name; log it." One append-only row per request to move a
real Work Unit's scenario allocation from VERDICT's own S2 (derived) toward
S3 (ceiling) -- `reason` and `moderated_by` are both required at the schema
layer (schemas/moderation.py), not just greyed out in the UI.

This is a logged opinion, never a write to verdict_scores or work_units:
nothing here changes a real VERDICT score, promotes a Work Unit on the
autonomy ladder (BUILD_PROGRAM.md's "no ladder" refusal), or touches the
dual-employment stop -- appetite recorded here cannot lift a hard gate.
from_level/to_level are the S2/S3 integers the caller already computed
client-side via the same scenarioStrip() replay Document check and Work
Chart use; this table does not recompute or verify them against a live
VerdictScore row, the same way AuditLog.detail is caller-described text,
not re-derived server-side."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ModerationEntry(Base):
    __tablename__ = "moderation_entries"
    __table_args__ = (Index("ix_moderation_entries_client", "client_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    work_unit_code: Mapped[str] = mapped_column(String(40))
    from_level: Mapped[int] = mapped_column(Integer)
    to_level: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(2000))
    moderated_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    client: Mapped["Client"] = relationship()
