"""P0 foundation: tenant boundary security, consent, audit, and structured provenance.

"Org" in the Scout/WEP handoff spec maps onto the existing Client/client_id
tenant boundary (models/client.py) — this file does not introduce a parallel
`orgs` table, since Client already is the census/company boundary every
other tenant-scoped table (work_units, intent_sources, discovery_candidates,
conformance_gaps) FKs against. Renaming Client -> Org across the codebase
would touch every router/service for no functional gain; the external
Scout API surface can present client_id as "org_id" without an internal
rename.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, Integer, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base
from .ontology import Provenance


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OrgApiKey(Base):
    """Per-tenant Spec API / genome-import credential. Replaces the single
    global settings.spec_api_key. Never stores the raw key — only its hash."""
    __tablename__ = "org_api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    label: Mapped[str] = mapped_column(String(120), default="")
    key_hash: Mapped[str] = mapped_column(String(128))  # sha256 hex digest
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Slice 3 PR 3a: set on the OLD row by POST /org/keys/rotate, alongside
    # is_active=False. A rotated key keeps authenticating until this expires
    # (dependencies.ROTATION_GRACE_MINUTES), then 401s like any other dead key.
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client: Mapped["Client"] = relationship()


class ConsentStatus(str, enum.Enum):
    active = "active"
    withdrawn = "withdrawn"
    purged = "purged"


class ConsentReceipt(Base):
    """DPDP Act 2023 style consent receipt. An interview/transcript may not be
    stored without one; absent consent, discovery runs in notes-only mode
    (same 18-attribute tagging, no recording retained).

    Slice 3 PR 3c: added revoked_at/purged_at alongside the existing `status`
    enum — status alone (P0) told you *whether* a receipt left the active
    state but not *when*, which both the revoke endpoint and the purge job
    need to record. auto_purge_at is this receipt's expiry (consent_timestamp
    + retention_days, set once at creation); the daily purge job scans for
    status=active rows past it."""
    __tablename__ = "consent_receipts"
    __table_args__ = (
        Index("ix_consent_receipts_client_expiry", "client_id", "auto_purge_at"),
        Index("ix_consent_receipts_client_subject", "client_id", "interview_ref"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    interview_ref: Mapped[str] = mapped_column(String(200), default="")
    data_principal_initials: Mapped[str] = mapped_column(String(20), default="")  # scrubbed, never a full name
    purpose: Mapped[str] = mapped_column(Text, default="")
    consent_text: Mapped[str] = mapped_column(Text, default="")
    consent_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    retention_days: Mapped[int] = mapped_column(Integer, default=90)
    withdrawal_method: Mapped[str] = mapped_column(String(200), default="")
    auto_purge_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[ConsentStatus] = mapped_column(Enum(ConsentStatus), default=ConsentStatus.active)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client: Mapped["Client"] = relationship()


class AuditLog(Base):
    """Every import, ratify, and read of a genome is logged here (G6 audit trail)."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True)
    actor: Mapped[str] = mapped_column(String(120), default="")
    action: Mapped[str] = mapped_column(String(80))  # e.g. "genome.import", "genome.ratify"
    resource: Mapped[str] = mapped_column(String(80), default="")
    resource_id: Mapped[str] = mapped_column(String(80), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class UploadedFile(Base):
    """One ingested CSV/Excel/JSON file. sha256 is the file fingerprint that every
    provenance record cites (E7: separating what was observed from what was invented)."""
    __tablename__ = "uploaded_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    file_name: Mapped[str] = mapped_column(String(300))
    sha256: Mapped[str] = mapped_column(String(64))
    content_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    # Slice 1 PR 1b: PR 1a computed sha256 but never persisted the bytes
    # themselves, so a later classifier had nothing to read. Nullable so
    # pre-1b rows (if any survive from PR 1a testing) don't violate a
    # NOT NULL add; every upload from this PR forward always sets it.
    content: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    uploaded_by: Mapped[str] = mapped_column(String(120), default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    client: Mapped["Client"] = relationship()


class GenomeVersionType(str, enum.Enum):
    inferred = "inferred"   # v1: after Function Leader interview only
    detailed = "detailed"   # v2: after SME + bulk docs, Observed provenance
    ratified = "ratified"   # v3: after Playback 2 + manager approval


class GenomeVersion(Base):
    """One import/version event. GQS + gate results are stored with the version
    so a blocked import (GQS<90) is still auditable, not silently discarded."""
    __tablename__ = "genome_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    version_type: Mapped[GenomeVersionType] = mapped_column(
        Enum(GenomeVersionType), default=GenomeVersionType.inferred)
    sequence: Mapped[int] = mapped_column(Integer, default=1)  # v1, v2, v3... per client
    # Bug found in Slice 1 PR 1b: this was typed Integer despite the Python
    # hint saying float — every stored score got truncated (94.29 -> 94).
    # Confirmed live: the GQS endpoint had been returning 94, not 94.29.
    gqs_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    work_unit_count: Mapped[int] = mapped_column(Integer, default=0)
    gates_passed: Mapped[str] = mapped_column(Text, default="[]")   # JSON list of gate ids that passed
    gates_failed: Mapped[str] = mapped_column(Text, default="[]")   # JSON list of {gate_id, reason}
    changes_summary: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of semantic-diff sentences
    ratified: Mapped[bool] = mapped_column(default=False)
    ratified_by: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    client: Mapped["Client"] = relationship()


class ReviewQueueStatus(str, enum.Enum):
    pending = "pending"
    resolved = "resolved"
    rejected = "rejected"


class ReviewQueueItem(Base):
    """Format-classifier confidence <0.7, or a Track B guardrail rejection
    (LLM output not a substring of raw_text), lands here instead of silently
    guessing (R2 in the risk register)."""
    __tablename__ = "review_queue"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    file_id: Mapped[int | None] = mapped_column(ForeignKey("uploaded_files.id"), nullable=True)
    row_ref: Mapped[int | None] = mapped_column(Integer, nullable=True)
    col_ref: Mapped[str] = mapped_column(String(120), default="")  # added Slice 1 PR 1b
    raw_text: Mapped[str] = mapped_column(Text, default="")  # added Slice 1 PR 1b
    # Same Integer-typed-as-float bug as GenomeVersion.gqs_score above, fixed here too.
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ReviewQueueStatus] = mapped_column(Enum(ReviewQueueStatus), default=ReviewQueueStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    client: Mapped["Client"] = relationship()
    file: Mapped["UploadedFile | None"] = relationship()


class WorkUnitProvenanceDetail(Base):
    """Structured provenance (E7) for one Work Unit — extends the existing
    WorkUnit.provenance enum column with the machine-verifiable detail the
    enum alone can't carry: which file, which row, which hash, which interview.
    1:1 with WorkUnit; the enum column stays the fast-filterable summary."""
    __tablename__ = "work_unit_provenance"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"), unique=True)
    source_type: Mapped[Provenance] = mapped_column(Enum(Provenance), default=Provenance.designed)
    file_id: Mapped[int | None] = mapped_column(ForeignKey("uploaded_files.id"), nullable=True)
    row_ref: Mapped[int | None] = mapped_column(Integer, nullable=True)
    col_ref: Mapped[str] = mapped_column(String(120), default="")
    hash_sha256: Mapped[str] = mapped_column(String(64), default="")
    source_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interview_ref: Mapped[str] = mapped_column(String(200), default="")
    consent_receipt_id: Mapped[int | None] = mapped_column(ForeignKey("consent_receipts.id"), nullable=True)

    work_unit: Mapped["WorkUnit"] = relationship()
    file: Mapped["UploadedFile | None"] = relationship()
    consent_receipt: Mapped["ConsentReceipt | None"] = relationship()


class WorkUnitRegulatoryLink(Base):
    """Many-to-many RR-ID linkage. WorkUnit.regulatory_entry_id (single FK)
    stays for the simple case; this table is additive for units that cite
    more than one regulatory_entries row."""
    __tablename__ = "work_unit_regulatory_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    regulatory_entry_id: Mapped[int] = mapped_column(ForeignKey("regulatory_entries.id"))

    work_unit: Mapped["WorkUnit"] = relationship()
    regulatory_entry: Mapped["RegulatoryEntry"] = relationship()


class PiiFieldValue(Base):
    """Field-level PII encryption (pgcrypto pgp_sym_encrypt/decrypt, applied in
    services/pii.py). One row per (work_unit, field) that was flagged as
    containing PII on import. The plaintext never lands in work_units."""
    __tablename__ = "pii_field_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    field_name: Mapped[str] = mapped_column(String(60))  # e.g. "inputs", "authority"
    pii_type: Mapped[str] = mapped_column(String(30), default="other")  # email|phone|uan|name|other
    encrypted_value: Mapped[bytes] = mapped_column(LargeBinary)
    redacted_preview: Mapped[str] = mapped_column(String(80), default="")  # first 3 chars + ***
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    work_unit: Mapped["WorkUnit"] = relationship()


class Ratification(Base):
    """Slice 2 PR 2b: per-Work-Unit approval record. Whole-version ratify
    (both business_object and work_unit_ids null) still just sets
    GenomeVersion.ratified directly — no rows here for that path. A
    business_object- or work_unit_ids-scoped ratify creates/updates one row
    per targeted WU; GenomeVersion.ratified flips to true automatically
    once every WU on the version has an approved=True row."""
    __tablename__ = "ratifications"
    __table_args__ = (UniqueConstraint("version_id", "work_unit_id", name="uq_ratifications_version_wu"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    version_id: Mapped[int] = mapped_column(ForeignKey("genome_versions.id"))
    work_unit_id: Mapped[int] = mapped_column(ForeignKey("work_units.id"))
    business_object: Mapped[str] = mapped_column(String(200), default="")
    approved: Mapped[bool] = mapped_column(default=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    ratified_by: Mapped[str] = mapped_column(String(120), default="")
    ratified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    client: Mapped["Client"] = relationship()
    version: Mapped["GenomeVersion"] = relationship()
    work_unit: Mapped["WorkUnit"] = relationship()
