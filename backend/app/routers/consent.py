"""Slice 3 PR 3c: DPDP consent receipts. Tenant-scoped via X-Spec-Key, same
OrgKeyDep/TenantDbDep pattern as work_units/spec/census (Slice 3 PR 3a) —
not the legacy global key. consent_receipts already carried RLS
(tenant_isolation policy, alembic 9a07306c5434) from the P0 foundation; this
PR is the first HTTP surface that writes to it."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.security import AuditLog, ConsentReceipt, ConsentStatus
from ..schemas.common import Page
from ..schemas.consent import ConsentReceiptCreate, ConsentReceiptOut, ConsentRevokeIn
from ..services import consent as consent_svc
from ..services.lookup import get_or_404

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/receipts", response_model=ConsentReceiptOut, status_code=status.HTTP_201_CREATED)
def create_receipt(payload: ConsentReceiptCreate, db: TenantDbDep, key: OrgKeyDep) -> ConsentReceiptOut:
    now = _utcnow()
    receipt = ConsentReceipt(
        client_id=key.client_id,
        interview_ref=payload.subject_id,
        data_principal_initials=payload.data_principal_initials,
        purpose=payload.purpose,
        consent_text=payload.consent_text,
        consent_timestamp=now,
        retention_days=payload.retention_days,
        auto_purge_at=now + timedelta(days=payload.retention_days),
    )
    db.add(receipt)
    db.flush()
    db.add(AuditLog(
        client_id=key.client_id,
        actor=key.label or f"org_api_key:{key.id}",
        action="org.consent.receipt.create",
        resource="consent_receipt",
        resource_id=str(receipt.id),
        detail=f"purpose={payload.purpose}",
    ))
    db.commit()
    db.refresh(receipt)
    return consent_svc.to_out(receipt)


@router.get("/receipts", response_model=Page[ConsentReceiptOut])
def list_receipts(db: TenantDbDep, key: OrgKeyDep) -> Page[ConsentReceiptOut]:
    rows = db.query(ConsentReceipt).order_by(ConsentReceipt.id).all()
    return Page(total=len(rows), items=[consent_svc.to_out(r) for r in rows])


@router.get("/receipts/{receipt_id}", response_model=ConsentReceiptOut)
def get_receipt(receipt_id: int, db: TenantDbDep, key: OrgKeyDep) -> ConsentReceiptOut:
    receipt = get_or_404(db, ConsentReceipt, receipt_id, "ConsentReceipt")
    return consent_svc.to_out(receipt)


@router.post("/receipts/{receipt_id}/revoke", response_model=ConsentReceiptOut)
def revoke_receipt(receipt_id: int, payload: ConsentRevokeIn, db: TenantDbDep, key: OrgKeyDep) -> ConsentReceiptOut:
    receipt = get_or_404(db, ConsentReceipt, receipt_id, "ConsentReceipt")
    now = _utcnow()
    receipt.status = ConsentStatus.withdrawn
    receipt.revoked_at = now
    if payload.withdrawal_method:
        receipt.withdrawal_method = payload.withdrawal_method
    db.add(AuditLog(
        client_id=key.client_id,
        actor=key.label or f"org_api_key:{key.id}",
        action="org.consent.receipt.revoke",
        resource="consent_receipt",
        resource_id=str(receipt.id),
    ))
    db.commit()
    db.refresh(receipt)
    return consent_svc.to_out(receipt)
