"""Scout Elevated V2 PR1: interview sessions + live-captured work-unit rows.
Draft state only — promoting a captured unit into a real WorkUnit happens
through the existing genome import path (services/genome_import.py), not
here. Same tenant boundary as everything else: client_id -> clients.id,
RLS via app.current_client_id (see alembic revision for this PR)."""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InterviewType(str, enum.Enum):
    """Three organizational altitudes an interview session captures at.
    Unrelated to Work Unit autonomy L1-L6 (services/verdict.py) despite the
    coincidence of small integers nearby — see docs/Work-Engineering-V8.md
    Part K, which is why business-object disclosure dropped its own former
    "L1/L2/L3" labels rather than let three different numbering schemes
    share notation.

    function_head: strategic (e.g. CHRO) - blast radius, ownership, goals.
    sub_function_lead: functional (e.g. Head of TA, Head of People Ops) -
      Work Unit definition, systems, frequency.
    sme: operational (specialist/operator) - task-level detail, exceptions,
      time-motion. Unchanged from the original two-track design.

    Renamed from ("founder", "sme") via Alembic ALTER TYPE ... RENAME VALUE
    (existing rows carry the new label automatically) plus one ADD VALUE
    for the new middle tier -- see the migration for why a value rename,
    not a new column, was the right tool here."""
    function_head = "function_head"
    sub_function_lead = "sub_function_lead"
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
    # Elevation 1 (Time-Travel Replay): JSON-serialized {"blocks": [...], "gaps": [...]}
    # -- built by services/scout_timeline.py, editable via PATCH .../timeline.
    # Text, not a native JSON/JSONB column: same convention as
    # GenomeVersion.gates_passed/gates_failed -- SQLite (the fast, non-RLS
    # test suite's DB) can't compile a Postgres JSONB column.
    timeline_json: Mapped[str] = mapped_column(Text, default="{}")
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


class ContradictionStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class ScoutContradiction(Base):
    """Elevation 2: function_head vs SME truth merge. The design doc keys this on
    work_unit_id, but nothing here is a real WorkUnit yet (captured units
    stay in draft state until genome generation) -- keyed on unit_name
    instead, matched case-insensitively across a function_head-type and an
    sme-type session for the same client. Detected on read (GET
    /contradictions re-scans and upserts), not on every unit write --
    cheap enough at this scale and avoids stale rows if either side's
    unit is later edited to agree."""
    __tablename__ = "scout_contradictions"
    __table_args__ = (Index("ix_scout_contradictions_client", "client_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    unit_name: Mapped[str] = mapped_column(String(200))
    field: Mapped[str] = mapped_column(String(40))  # "systems" | "frequency" | "inputs"
    founder_session_id: Mapped[int] = mapped_column(ForeignKey("scout_interview_sessions.id"))
    sme_session_id: Mapped[int] = mapped_column(ForeignKey("scout_interview_sessions.id"))
    founder_text: Mapped[str] = mapped_column(Text, default="")
    sme_text: Mapped[str] = mapped_column(Text, default="")
    # Confidence a real difference exists, not a measured statistic --
    # 1.0 when both sides gave a non-empty, differing answer; lower when
    # one side is empty (could just be an unanswered question, not a
    # genuine contradiction). Named so it's never mistaken for the kind
    # of measured confidence GQS/kappa use elsewhere in this codebase.
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    resolution: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ContradictionStatus] = mapped_column(Enum(ContradictionStatus), default=ContradictionStatus.open)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    client: Mapped["Client"] = relationship()


class ScoutBlastRadiusSelection(Base):
    """Point 2 of the Scout Elevated upgrade thread: the function_head's
    (CHRO's) blast-radius scoping pass over the fixed 44-sub-function HR
    catalog (services/scout_blast_radius.py -- the catalog itself is not a
    table, since it's a published list, not per-tenant data). One row per
    sub-function a tenant has actually touched (checked in/out of scope,
    named an owner, or set a priority) -- sub-functions nobody has touched
    yet have no row at all, and read back from the catalog default
    (in_scope=False, owner_name="", priority="") rather than a pre-seeded
    row per tenant."""
    __tablename__ = "scout_blast_radius_selections"
    __table_args__ = (
        UniqueConstraint("client_id", "sub_function_key", name="uq_blast_radius_client_subfn"),
        Index("ix_blast_radius_client", "client_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    sub_function_key: Mapped[str] = mapped_column(String(80))
    in_scope: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_name: Mapped[str] = mapped_column(String(160), default="")
    # "P0" | "P1" | "" (unset) -- see schemas/scout.py's pattern validator.
    priority: Mapped[str] = mapped_column(String(4), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    client: Mapped["Client"] = relationship()
