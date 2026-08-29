"""Slice 3 PR 3c: 90-day consent auto-purge. Cross-tenant by nature (a daily
sweep over every client's expired receipts), so — same as
services.tenants.bootstrap_tenants — this runs on the RLS-bypassing system
session, never the per-request tenant-scoped one."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models.security import AuditLog, ConsentReceipt, ConsentStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def purge_expired_consents(db: Session) -> int:
    """Tombstone (status -> purged) every active receipt past its
    auto_purge_at. Withdrawn receipts are left alone — withdrawal already
    recorded the subject's exit; the timer isn't a second purge path for
    them. Returns the count purged (0 until a real receipt exists and ages
    past expiry — that's expected, it proves the path)."""
    now = _utcnow()
    expired = (
        db.query(ConsentReceipt)
        .filter(
            ConsentReceipt.status == ConsentStatus.active,
            ConsentReceipt.auto_purge_at.isnot(None),
            ConsentReceipt.auto_purge_at < now,
        )
        .all()
    )
    for receipt in expired:
        receipt.status = ConsentStatus.purged
        receipt.purged_at = now
        db.add(AuditLog(
            client_id=receipt.client_id,
            actor="system:purge_expired_consents",
            action="consent.receipt.purge",
            resource="consent_receipt",
            resource_id=str(receipt.id),
            detail=f"auto_purge_at={receipt.auto_purge_at.isoformat()}",
        ))
    db.commit()
    return len(expired)
