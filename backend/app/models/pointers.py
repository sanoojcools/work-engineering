"""V10-2 (docs/V10_BUILD.md, docs/BUILD_PROGRAM.md): field-level evidence
pointers + resolver + five statuses.

This is deliberately a NEW, additive table rather than a change to the
existing 1:1 WorkUnitProvenanceDetail (models/security.py) -- that table
already has a fixed meaning (one row per Work Unit, written once at genome
import time) that several routers/tests depend on unchanged. A pointer here
is field-scoped (one row per work_unit + field_name, e.g. "authority"),
because the binding-field rule ("authority/acceptance/constraints = declared
+ quote only") is a per-field claim, not a per-unit one. It still REUSES the
existing UploadedFile table as the thing a pointer resolves against -- no
parallel file store.

Five statuses (distinct from models/ontology.py's four-value Provenance
enum, which is a different, coarser classification used at genome-import
time): observed/declared/reconstructed/composed are all "we have or can
have a reason to believe this," predicted is "we do not." See
services/pointers.py for what "resolver on write" actually checks per file
type, and for why a broken pointer downgrades a claim to predicted rather
than silently keeping the stronger label.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PointerStatus(str, enum.Enum):
    observed = "observed"            # read directly off an opened pointer
    declared = "declared"            # a document says so -- binding-eligible with a verified quote
    reconstructed = "reconstructed"  # pieced together from partial/indirect evidence
    composed = "composed"            # written by a person combining judgement, not a quote
    predicted = "predicted"          # a guess -- no verifiable backing, never binding


class FieldPointer(Base):
    """One evidence claim for one (work_unit, field). `requested_status` is
    what the caller asserted; `status` is what actually stands after the
    resolver ran -- they diverge exactly when a claimed observed/
    reconstructed pointer failed to open, which is downgraded to `predicted`
    rather than trusted (services/pointers.py::upsert_field_pointer)."""
    __tablename__ = "field_pointers"
    __table_args__ = (
        UniqueConstraint("work_unit_id", "field_name", name="uq_field_pointers_unit_field"),
        Index("ix_field_pointers_work_unit", "work_unit_id"),
        Index("ix_field_pointers_file", "file_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    field_name: Mapped[str] = mapped_column(String(60))

    requested_status: Mapped[PointerStatus] = mapped_column(Enum(PointerStatus))
    status: Mapped[PointerStatus] = mapped_column(Enum(PointerStatus))

    # The pointer itself: file_id + page/line/cell (V10_BUILD.md). CSV/XLSX
    # resolve via `cell` (an "A1"-style reference); `page`/`line` are for a
    # future PDF/text parser this PR does not add -- see services/pointers.py.
    file_id: Mapped[int | None] = mapped_column(ForeignKey("uploaded_files.id"), nullable=True)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cell: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Required, verified-verbatim for a binding field (services/pointers.py
    # checks it is a literal substring of the resolved cell before trusting
    # it) -- same "checked against the source, not trusted" rule
    # services/scout_story.py already applies to LLM-extracted spans.
    quote: Mapped[str] = mapped_column(Text, default="")

    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_note: Mapped[str] = mapped_column(Text, default="")
    gap_id: Mapped[int | None] = mapped_column(ForeignKey("conformance_gaps.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()
    file: Mapped["UploadedFile | None"] = relationship()
    gap: Mapped["ConformanceGap | None"] = relationship()
