"""V10-5 (docs/NEXT.md, docs/V10_BUILD.md "Claude outcome_records"): one
promised-vs-measured record per Work System. `promised` is copied once from
WorkSystem.outcome (the sitting outcome sentence, itself sourced from Offer
Desk meta at work-system-ensure time -- see services/work_system.py) and
never rewritten by this table's own API. `measured` stays null / status
stays `not_measured` until a caller states a real, numeric result with a
named source through PUT -- there is no path that invents one (V10_BUILD.md
Tier 3: "promised vs not measured (never invent)")."""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OutcomeStatus(str, enum.Enum):
    not_measured = "not_measured"
    measured = "measured"


class OutcomeRecord(Base):
    """One row per Work System. Upserted via PUT
    /work-systems/{id}/outcome; auto-vivified with the honest default on
    first GET (see services/outcome.py::get_or_create) so "not yet measured"
    is always a real row, never a 404."""
    __tablename__ = "outcome_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_system_id: Mapped[int] = mapped_column(ForeignKey("work_systems.id"), unique=True)

    promised: Mapped[str] = mapped_column(Text, default="")
    # Nullable free text -- "or not_stated" per this table's own Tier 3 rule.
    # Never populated by this codebase itself, only by a caller's PUT.
    measured: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[OutcomeStatus] = mapped_column(Enum(OutcomeStatus), default=OutcomeStatus.not_measured)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    work_system: Mapped["WorkSystem"] = relationship()
