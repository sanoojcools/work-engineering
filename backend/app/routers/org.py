"""Slice 3 PR 3a (playbook G.1): per-org API key lifecycle. Rotation is the
only issuance path in this pass — minting a brand-new org's first key is
still an ops/test-fixture action (direct org_api_keys insert), same as
genome import's caller today."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from ..dependencies import ROTATION_GRACE_MINUTES, OrgKeyDep, TenantDbDep
from ..models.security import AuditLog, OrgApiKey

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/keys/rotate")
def rotate_key(db: TenantDbDep, key: OrgKeyDep) -> dict:
    now = _utcnow()
    new_plaintext = secrets.token_urlsafe(32)
    new_hash = hashlib.sha256(new_plaintext.encode("utf-8")).hexdigest()

    key.is_active = False
    key.rotated_at = now
    key.expires_at = now + timedelta(minutes=ROTATION_GRACE_MINUTES)

    new_row = OrgApiKey(client_id=key.client_id, label=key.label, key_hash=new_hash, is_active=True)
    db.add(new_row)
    db.add(AuditLog(
        client_id=key.client_id,
        actor=key.label or f"org_api_key:{key.id}",
        action="org.key.rotate",
        resource="org_api_key",
        resource_id=str(key.id),
        detail=f"grace_expires_at={key.expires_at.isoformat()}",
    ))
    db.commit()
    db.refresh(new_row)

    return {
        "client_id": key.client_id,
        "key": new_plaintext,
        "key_id": new_row.id,
        "old_key_id": key.id,
        "old_key_expires_at": key.expires_at.isoformat(),
    }
