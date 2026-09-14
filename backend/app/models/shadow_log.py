"""MANDATE-4 (docs/contracts/mandate-4-shadow.md): in-app self-reported
finish times for one piece of work -- no Slack, no Workday, no Clerk. A
shadow log is a candidate's/performer's own claim about when a work unit
finished, capped at five rows per unit so this stays a lightweight signal,
never a second system of record. It is NOT a Work System (models/work_system.py)
and NOT an Observed system log -- see services/shadow_log.py's summary,
which is hard-labelled self_reported/low and never blended into stated/
defended (STATED_HOURS_MO / DEFENDED_HOURS_MO, services/simulator.py)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ShadowLog(Base):
    __tablename__ = "shadow_logs"
    __table_args__ = (
        UniqueConstraint("client_id", "work_unit_id", "occurred_at", name="uq_shadow_logs_client_unit_occurred"),
        Index("ix_shadow_logs_client", "client_id"),
        Index("ix_shadow_logs_work_unit", "work_unit_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 1-480 inclusive, enforced at the API layer (schemas/shadow_log.py) --
    # null means the performer didn't state a duration, never a guess.
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(String(240), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    client: Mapped["Client"] = relationship()
    work_unit: Mapped["WorkUnit"] = relationship()
