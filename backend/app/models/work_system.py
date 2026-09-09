"""CENSUS-v0 Part B: One Work System (the "missing middle"). A Work System is
a named cross-desk journey -- this slice ships exactly one: recruiter asks
for an offer -> offer released -> Day-1 ready (Offer Desk + Onboarding).
Not a second WorkUnit table: entry/exit/owner/outcome describe the journey
itself, not any one step inside it, and `code` is a fixed, small catalog
(one row today), not a per-tenant free-for-all -- the same "known small set,
one real column per touched row" shape as ScoutBlastRadiusSelection.

Ratify is the one write this table exists for: a candidate Work System
becomes governed only on a keyed, named, timestamped Ratify click (V10 rule
-- see docs/BUILD_PROGRAM.md CENSUS-v0 Part B). Real persistence, not
in-session state, so Ratify survives a refresh -- the build doc's own
preference when a minimal table is cheap enough, and this one is."""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkSystemStatus(str, enum.Enum):
    candidate = "candidate"
    ratified = "ratified"


class WorkSystem(Base):
    __tablename__ = "work_systems"
    __table_args__ = (
        UniqueConstraint("client_id", "code", name="uq_work_systems_client_code"),
        Index("ix_work_systems_client", "client_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    # Fixed catalog code for the one journey this slice ships -- see
    # frontend/src/lib/workSystem.ts's OFFER_TO_ONBOARDING_CODE. Not
    # user-chosen: a second code would be a second journey (Offboarding),
    # explicitly out of scope for CENSUS-v0.
    code: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(200))
    entry: Mapped[str] = mapped_column(Text, default="")
    exit: Mapped[str] = mapped_column(Text, default="")
    # "Labelled stand-in unless a real name exists" (V10 rule) -- the
    # journey spans two desks with two different real SPOCs and nobody
    # today owns the cross-desk handoff itself, so this is honestly a
    # stand-in label, same idiom as OFFER_DESK_SEATS' own stand-in seats.
    owner: Mapped[str] = mapped_column(String(160), default="")
    outcome: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[WorkSystemStatus] = mapped_column(Enum(WorkSystemStatus), default=WorkSystemStatus.candidate)
    ratified_by: Mapped[str] = mapped_column(String(120), default="")
    ratified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # D -- INTENT-LITE (docs/BUILD_PROGRAM.md). Two intents, both attached to
    # this one journey row -- not a second table, not a per-tenant free-for-
    # all (see the module docstring). Text fields are drafted client-side
    # from sheet/sitting text and sent once via the same get-or-create POST
    # that already seeds entry/exit/owner/outcome; a later ensure call never
    # overwrites them, identical to how those four fields already behave.
    # draft vs confirmed is *derived* from confirmed_at being null (see
    # services/work_system.py::to_out) -- there is no separate status enum
    # to drift out of sync with it.
    function_intent_outcome: Mapped[str] = mapped_column(Text, default="")
    function_intent_owner: Mapped[str] = mapped_column(String(160), default="")
    function_intent_measure: Mapped[str] = mapped_column(Text, default="")
    function_intent_confirmed_by: Mapped[str] = mapped_column(String(120), default="")
    function_intent_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    work_system_intent_purpose: Mapped[str] = mapped_column(Text, default="")
    work_system_intent_owner: Mapped[str] = mapped_column(String(160), default="")
    work_system_intent_confirmed_by: Mapped[str] = mapped_column(String(120), default="")
    work_system_intent_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # V10-9 (docs/V10_BUILD.md "STRATEGY INTENT -- one line, not a studio"):
    # the third, and last, intent level on this one journey row -- same
    # get-or-create-once, confirm-flips-a-timestamp shape as the two above,
    # not a fourth table and not INT-007 (docs/INTENT_CONTRACT.md's refusal
    # still holds: no new identifier or table for intent records). `focus`
    # is the one-line "what this period is about" sentence; `owner` is a
    # named human or an explicit stand-in label until a real sponsor exists
    # -- same idiom as this table's own `owner` column.
    strategy_intent_focus: Mapped[str] = mapped_column(Text, default="")
    strategy_intent_owner: Mapped[str] = mapped_column(String(160), default="")
    strategy_intent_confirmed_by: Mapped[str] = mapped_column(String(120), default="")
    strategy_intent_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    client: Mapped["Client"] = relationship()
