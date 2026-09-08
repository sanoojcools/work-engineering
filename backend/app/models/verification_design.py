"""V10-3 (docs/V10_BUILD.md, docs/BUILD_PROGRAM.md): verification design +
certification -- the canon "Verification design + independence" scoreboard
row (docs/V10_CLOSE.md).

One row per Work Unit (same shape as VerdictScore/CostProfile: a unique
work_unit_id, upserted via PUT). This is the PLAN for how a unit's claims
get checked -- method, independence, sampling, cost -- distinct from
models/verification.py's VerificationRun, which is one row per actual
EXECUTED check (G3). A unit can have a verification_design with zero runs
against it yet.

Certification is deliberately its own column, answering a third, different
question from the two existing classifications already in this codebase:
- models/ontology.py's Provenance (4 values: observed/declared/inferred/
  designed) -- set at genome-import time, about where a Work Unit's data
  came from.
- models/pointers.py's PointerStatus (5 values, V10-2) -- set per field,
  about whether one field's evidence pointer actually opens.
CertificationClass answers neither of those -- it is a human's own stated
confidence that a unit's contract is correct, after everything above. See
services/verification_design.py for the one enforced cross-check between
this column and PointerStatus: a "predicted" (unverifiable) field pointer
means the unit cannot be certified "sure".
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .workunit import VerificationMethod


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class IndependenceKind(str, enum.Enum):
    """BUILD_PROGRAM.md's "independent? (different lineage / deterministic /
    no)" -- three-valued, not boolean: a check counts as independent either
    because a different source/system did it (different_lineage) or because
    the method itself is deterministic and has no judgement to bias
    (deterministic); anything else is "no"."""
    different_lineage = "different_lineage"
    deterministic = "deterministic"
    no = "no"


class CertificationClass(str, enum.Enum):
    sure = "sure"
    mostly_sure = "mostly_sure"
    reported_not_seen = "reported_not_seen"
    cannot_define = "cannot_define"


class ErrorCost(str, enum.Enum):
    """What a wrong call here costs. Stored and defaulted per V10_BUILD.md
    ("error-cost = contestable default") -- this slice does not yet compute
    a harm/exposure number from it (that is V10-6's economics slice); the
    column exists so this slice's Plan UI, and that later one, have
    somewhere honest to read/write it rather than inventing a number now."""
    contestable = "contestable"   # a wrong call can be caught and disputed after the fact
    irreversible = "irreversible"


class VerificationDesign(Base):
    """The verification PLAN for one Work Unit. Upserted via PUT
    /work-units/{id}/verification-design, same shape as VerdictScore."""
    __tablename__ = "verification_designs"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"), unique=True)

    # None = "no method stated" (BUILD_PROGRAM.md's "one of seven or none").
    method: Mapped[VerificationMethod | None] = mapped_column(Enum(VerificationMethod), nullable=True)
    independence: Mapped[IndependenceKind] = mapped_column(Enum(IndependenceKind), default=IndependenceKind.no)
    # Explicit, caller-stated requirement -- never inferred from the unit's
    # other fields (this codebase's own discipline: don't invent a fact
    # nobody stated). services/handoff.py ORs this with the non-waivable
    # trigger from an unconfirmed VerdictScore.origin -- see that module.
    independence_required: Mapped[bool] = mapped_column(Boolean, default=False)
    sampling: Mapped[str] = mapped_column(Text, default="not stated")
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)  # None == "not stated"
    error_cost: Mapped[ErrorCost] = mapped_column(Enum(ErrorCost), default=ErrorCost.contestable)

    certification: Mapped[CertificationClass] = mapped_column(
        Enum(CertificationClass), default=CertificationClass.cannot_define)
    # Free text naming the human who stands behind `certification` -- Plan's
    # "checked by" column (BUILD_PROGRAM.md). Never an agent/executor id:
    # see `dual_track` below.
    checked_by: Mapped[str] = mapped_column(String(120), default="")

    # Structural, not caller-settable (services/verification_design.py never
    # reads this off the write payload): "do" (WorkUnit.actor_type) may be
    # delegated to an agent; "check" -- this row -- never is. There is no
    # executor field for it to be delegated to, by design.
    dual_track: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()
