"""D1–D3: upward traces, downward intent, candidates, and the conformance gap."""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .ontology import Provenance


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TraceKind(str, enum.Enum):
    log = "log"
    email = "email"
    ticket = "ticket"
    transcript = "transcript"
    erp_event = "erp_event"
    process_mining = "process_mining"
    interview = "interview"
    shadowing = "shadowing"


class TraceEvent(Base):
    """Upward discovery input (D1): what execution actually produced."""
    __tablename__ = "trace_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_system: Mapped[str] = mapped_column(String(120), default="")
    kind: Mapped[TraceKind] = mapped_column(Enum(TraceKind), default=TraceKind.log)
    object_ref: Mapped[str] = mapped_column(String(200), default="")
    payload: Mapped[str] = mapped_column(Text, default="{}")
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    provenance: Mapped[Provenance] = mapped_column(Enum(Provenance), default=Provenance.observed)


class IntentKind(str, enum.Enum):
    policy = "policy"
    sop = "sop"
    okr = "okr"
    regulation = "regulation"
    job_description = "job_description"
    contract = "contract"


class IntentSource(Base):
    """Downward discovery input (D1): what the organisation says should happen."""
    __tablename__ = "intent_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[IntentKind] = mapped_column(Enum(IntentKind), default=IntentKind.sop)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    provenance: Mapped[Provenance] = mapped_column(Enum(Provenance), default=Provenance.declared)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)


class Origin(str, enum.Enum):
    upward = "upward"      # from traces
    downward = "downward"  # from intent


class CandidateStatus(str, enum.Enum):
    new = "new"
    merged = "merged"
    rejected = "rejected"


class DiscoveryCandidate(Base):
    """Partial Work Unit produced by discovery. Unreconciled until merged (E4)."""
    __tablename__ = "discovery_candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    origin: Mapped[Origin] = mapped_column(Enum(Origin), default=Origin.upward)
    provenance: Mapped[Provenance] = mapped_column(Enum(Provenance), default=Provenance.inferred)
    payload: Mapped[str] = mapped_column(Text, default="{}")  # partial 18-attribute JSON
    sampling_bias_note: Mapped[str] = mapped_column(Text, default="")  # D2
    status: Mapped[CandidateStatus] = mapped_column(Enum(CandidateStatus), default=CandidateStatus.new)
    work_unit_id: Mapped[int | None] = mapped_column(ForeignKey("work_units.id"), nullable=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)

    work_unit: Mapped["WorkUnit | None"] = relationship()


class GapKind(str, enum.Enum):
    shadow_process = "shadow_process"
    policy_violation = "policy_violation"
    missing_acceptance = "missing_acceptance"
    workaround = "workaround"
    undeclared = "undeclared"
    unimplemented = "unimplemented"


class ConformanceGap(Base):
    """D3: declared vs discovered. Standalone value before any agent is deployed."""
    __tablename__ = "conformance_gaps"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[GapKind] = mapped_column(Enum(GapKind), default=GapKind.undeclared)
    # Gate 10 (docs/ROADMAP-DECISIONS.md): P2 is the only severity anything
    # assigns today -- P0/P1 needs a business-criticality signal the schema
    # doesn't have yet, deferred to manual triage at ratification rather than
    # guessed at here. The column stays a plain string (not an enum) so that
    # future manual triage isn't blocked on a migration.
    severity: Mapped[str] = mapped_column(String(4), default="P2")
    description: Mapped[str] = mapped_column(Text, default="")
    discovered_ref: Mapped[str] = mapped_column(String(200), default="")
    declared_ref: Mapped[str] = mapped_column(String(200), default="")
    work_unit_id: Mapped[int | None] = mapped_column(ForeignKey("work_units.id"), nullable=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)

    work_unit: Mapped["WorkUnit | None"] = relationship()
