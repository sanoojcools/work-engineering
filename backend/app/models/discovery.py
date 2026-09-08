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
    # Gate 6 (docs/ROADMAP-DECISIONS.md, docs/BUILD_PROGRAM.md Track 1 slice
    # 1.2): advisory-only "this Work Unit looks like it should be split"
    # warning -- never blocks import, never auto-splits.
    split_recommended = "split_recommended"
    # Gate 9 (docs/ROADMAP-DECISIONS.md, docs/BUILD_PROGRAM.md Track 1 slice
    # 1.3): advisory-only "this business object's inferred state graph never
    # closes" warning -- never blocks import, never writes state_machine.
    missing_terminal_state = "missing_terminal_state"
    # V10-2 (docs/V10_BUILD.md): a field pointer claimed observed/
    # reconstructed but its file_id + page/line/cell could not be opened
    # (services/pointers.py::resolve_pointer) -- the claim is downgraded to
    # predicted and this gap records why, same warn-not-reject shape as
    # every other GapKind here.
    broken_pointer = "broken_pointer"
    # V10-5b (docs/NEXT.md, docs/V10_BUILD.md V10-5 "Gap 3 tiers"): the two
    # gaps that are NOT about one desk's own process. missing_handoff is the
    # journey tier -- the Work System's upstream desk never hands off to the
    # next desk (services/genome_import.py::_flag_missing_handoff).
    # outcome_not_measured is the outcome tier -- the Work System promises an
    # outcome and its outcome_records row still says not_measured
    # (::_flag_outcome_not_measured). Both warn, neither ever rejects, and
    # neither ever states a measured number.
    missing_handoff = "missing_handoff"
    outcome_not_measured = "outcome_not_measured"


class GapTier(str, enum.Enum):
    """V10-5b (docs/NEXT.md): which of the three layers a gap is about.

    Unlike ConformanceGap.severity -- deliberately a plain string so future
    manual triage isn't blocked on a migration -- this IS a real enum: the
    three tiers are canon (docs/V10_BUILD.md V10-5: "Tier 1 swimlane ... vs
    owned pieces. Tier 2 journey owner. Tier 3 promised vs not measured"),
    a closed set, and a fourth tier would be a change to the canon rather
    than a triage decision.

    `process`  -- Tier 1: one desk's own declared-vs-owned work (undeclared,
                  split_recommended, missing_terminal_state, and every
                  pre-V10-5b kind). The default, so nothing that already
                  writes a gap has to change to keep telling the truth.
    `journey`  -- Tier 2: the cross-desk seam inside a Work System, which no
                  single desk owns.
    `outcome`  -- Tier 3: the Work System's promise vs what was measured.
    """
    process = "process"
    journey = "journey"
    outcome = "outcome"


# A gap's tier is a property of its kind, not an independent judgement, so
# this mapping is the single place the two can be kept from drifting apart
# (tests/test_v10_5b_gap_tiers.py asserts every GapKind is covered). Only
# the two V10-5b kinds are non-`process`: everything else -- discovery's
# scan, pointers' broken_pointer, Gates 6/9/10 -- is about one desk's own
# process, which is exactly why `process` is the column default.
TIER_BY_KIND: dict[GapKind, GapTier] = {
    GapKind.missing_handoff: GapTier.journey,
    GapKind.outcome_not_measured: GapTier.outcome,
}


def tier_for_kind(kind: GapKind) -> GapTier:
    return TIER_BY_KIND.get(kind, GapTier.process)


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
    # V10-5b (docs/NEXT.md): additive, defaults to `process` -- every gap
    # written before this column existed is a Tier 1 process gap, and every
    # writer that doesn't name a tier still is one. Set from tier_for_kind()
    # at the write sites so it can never disagree with `kind`.
    tier: Mapped[GapTier] = mapped_column(Enum(GapTier), default=GapTier.process)
    description: Mapped[str] = mapped_column(Text, default="")
    discovered_ref: Mapped[str] = mapped_column(String(200), default="")
    declared_ref: Mapped[str] = mapped_column(String(200), default="")
    work_unit_id: Mapped[int | None] = mapped_column(ForeignKey("work_units.id"), nullable=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)

    work_unit: Mapped["WorkUnit | None"] = relationship()
