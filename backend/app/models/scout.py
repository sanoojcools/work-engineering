"""Scout Elevated V2 PR1: interview sessions + live-captured work-unit rows.
Draft state only — promoting a captured unit into a real WorkUnit happens
through the existing genome import path (services/genome_import.py), not
here. Same tenant boundary as everything else: client_id -> clients.id,
RLS via app.current_client_id (see alembic revision for this PR)."""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InterviewType(str, enum.Enum):
    founder = "founder"
    sme = "sme"


class InterviewStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"


class ScoutInterviewSession(Base):
    __tablename__ = "scout_interview_sessions"
    __table_args__ = (Index("ix_scout_sessions_client", "client_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    type: Mapped[InterviewType] = mapped_column(Enum(InterviewType), default=InterviewType.sme)
    interviewee_name: Mapped[str] = mapped_column(String(160), default="")
    status: Mapped[InterviewStatus] = mapped_column(Enum(InterviewStatus), default=InterviewStatus.in_progress)
    # Denormalized cache of the latest completeness calc (services/scout.py
    # recomputes and writes this on every unit create/update) so a session
    # list doesn't need to re-walk every unit's fields to render a number.
    completeness_pct: Mapped[float] = mapped_column(Float, default=0.0)
    # Slice 3 PR 3c's consent_receipts — a session's interviewee should have
    # a receipt before any capture begins, same rule as Scout-Reference.md's
    # "observed from an interview requires consent_receipt_id" (nullable
    # here only because the frontend flow enforces it before create; not a
    # backend bypass).
    consent_receipt_id: Mapped[int | None] = mapped_column(ForeignKey("consent_receipts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    client: Mapped["Client"] = relationship()
    consent_receipt: Mapped["ConsentReceipt | None"] = relationship()
    units: Mapped[list["ScoutCapturedUnit"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ScoutCapturedUnit.id"
    )


class ScoutCapturedUnit(Base):
    """One row in the live Work Capture Grid. Columns match the design
    doc's grid exactly (Work Unit / Inputs / Outputs / Systems / Frequency /
    Time / Pain / Handoffs) plus decision_rule, which the grid doesn't show
    as its own column but the Genome Strength Meter's "Decisions/Rules"
    dimension needs a real field to measure — captured via the interview
    question bank instead."""
    __tablename__ = "scout_captured_units"
    __table_args__ = (Index("ix_scout_units_session", "session_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("scout_interview_sessions.id"))
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    name: Mapped[str] = mapped_column(String(200), default="")
    inputs: Mapped[str] = mapped_column(Text, default="")
    outputs: Mapped[str] = mapped_column(Text, default="")
    systems: Mapped[str] = mapped_column(String(300), default="")
    frequency: Mapped[str] = mapped_column(String(120), default="")
    time_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    pain: Mapped[str] = mapped_column(Text, default="")
    handoffs: Mapped[str] = mapped_column(String(200), default="")
    decision_rule: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    session: Mapped["ScoutInterviewSession"] = relationship(back_populates="units")
    client: Mapped["Client"] = relationship()
