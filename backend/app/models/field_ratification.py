"""V10-8 (docs/contracts/v10-8-field-ratify.md): field ratify + decision
cards, backend only. Canon: sit close shows a drafted goal/authority/
acceptance beside the person's own words; a keyed confirm-or-correct is the
one write that turns a draft into a fact and copies it onto the Work Unit's
own column. This is deliberately NOT Work System ratify (models/work_system.py)
and NOT confirm-function-intent / confirm-work-system-intent -- those already
exist and are untouched.

Reuses `work_units.desired_condition` / `authority` / `acceptance_criteria` as
the write target (contract's Reuse table) rather than inventing a fourth
place those values live. `sitting_quote` is stored verbatim, never invented
here -- see services/field_ratification.py for the literal-substring check
against a `declared` field_pointers row when one exists."""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FieldRatificationField(str, enum.Enum):
    desired_condition = "desired_condition"
    authority = "authority"
    acceptance_criteria = "acceptance_criteria"


class FieldRatificationStatus(str, enum.Enum):
    drafted = "drafted"
    confirmed = "confirmed"
    corrected = "corrected"


class FieldRatification(Base):
    __tablename__ = "field_ratifications"
    __table_args__ = (
        UniqueConstraint(
            "client_id", "work_unit_id", "field_name",
            name="uq_field_ratifications_client_unit_field",
        ),
        Index("ix_field_ratifications_client", "client_id"),
        Index("ix_field_ratifications_work_unit", "work_unit_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    field_name: Mapped[FieldRatificationField] = mapped_column(Enum(FieldRatificationField))

    # Verbatim, from the person's own sitting words -- never invented by the
    # API (contract's "Quote rule on create").
    sitting_quote: Mapped[str] = mapped_column(Text)
    drafted_value: Mapped[str] = mapped_column(Text)
    confirmed_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[FieldRatificationStatus] = mapped_column(
        Enum(FieldRatificationStatus), default=FieldRatificationStatus.drafted)
    confirmed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    client: Mapped["Client"] = relationship()
    work_unit: Mapped["WorkUnit"] = relationship()
