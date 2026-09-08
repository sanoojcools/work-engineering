"""V10-3 contract (docs/contracts/v10-3-verify.md): verification design +
certification. Two separate 1:1-with-work_units tables, per the contract's
own instruction that certification is "separate table from provenance /
field_pointers" -- and, by the same reasoning, separate from the design
table itself, since a design is a plan for how a unit's claims get checked
while a certification is a human's stated confidence in the result. See
services/verification_design.py for the one enforced cross-check the
contract specifies between certification and V10-2's field pointers.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class VerificationDesignMethod(str, enum.Enum):
    """The contract's own seven values -- deliberately NOT
    models/workunit.py's VerificationMethod: that enum is the 18-attribute
    contract's execution-time method; this is separate, plain-language
    vocabulary for how a unit's claims get checked (Plan-column material).
    `none` is the explicit "nothing stated" value, and this column's
    default -- a unit with no verification_designs row at all reads
    identically to one whose row still says `method=none`."""
    document_check = "document_check"
    system_of_record = "system_of_record"
    second_person = "second_person"
    sample = "sample"
    reconcile = "reconcile"
    model_plus_human = "model_plus_human"
    none = "none"


class IndependenceKind(str, enum.Enum):
    different_lineage = "different_lineage"
    deterministic = "deterministic"
    no = "no"
    not_stated = "not_stated"


class CertificationClass(str, enum.Enum):
    sure = "sure"
    mostly_sure = "mostly_sure"
    reported_not_seen = "reported_not_seen"
    cannot_define = "cannot_define"


class VerificationDesign(Base):
    """The verification PLAN for one Work Unit. Upserted via PUT
    /work-units/{id}/verification-design."""
    __tablename__ = "verification_designs"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"), unique=True)

    method: Mapped[VerificationDesignMethod] = mapped_column(
        Enum(VerificationDesignMethod), default=VerificationDesignMethod.none)
    independent: Mapped[IndependenceKind] = mapped_column(
        Enum(IndependenceKind), default=IndependenceKind.not_stated)
    # Nullable text, "or not_stated" per the contract -- never imputed,
    # same "None means nobody said" convention as WorkUnit.volume_per_month.
    sampling: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_of_check: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Structural, not on the write schema at all (services/verification_design.py
    # never reads this off the payload): "do may be delegated, check stays
    # human. Never starts an agent" (contract, verbatim) -- always true.
    dual_track: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()


class Certification(Base):
    """Separate table from provenance / field_pointers (contract,
    verbatim). `class` is a Python keyword -- mapped to the `cert_class`
    attribute, DB column stays literally `class` per the contract's own
    naming."""
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"), unique=True)
    cert_class: Mapped[CertificationClass] = mapped_column(
        "class", Enum(CertificationClass), default=CertificationClass.cannot_define)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()
