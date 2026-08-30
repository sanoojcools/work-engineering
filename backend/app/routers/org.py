"""Slice 3 PR 3a (playbook G.1): per-org API key lifecycle. Rotation is the
only issuance path in this pass — minting a brand-new org's first key is
still an ops/test-fixture action (direct org_api_keys insert), same as
genome import's caller today."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import text

from ..dependencies import ROTATION_GRACE_MINUTES, OrgKeyDep, TenantDbDep
from ..models.client import Client
from ..models.security import AuditLog, OrgApiKey

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _rebind_tenant(db: TenantDbDep, key: OrgApiKey) -> None:
    """db.commit() hands the connection back to the pool; the next statement
    can be issued on a DIFFERENT pooled connection that never had
    app.current_client_id SET, so an RLS-filtered read after a commit sees
    zero rows and db.refresh() raises "Could not refresh instance". Same bug
    class and same fix as routers/scout.py::_rebind_tenant — re-apply the
    tenant binding after every commit, before any further read."""
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})


@router.get("/whoami")
def whoami(db: TenantDbDep, key: OrgKeyDep) -> dict:
    """Which tenant the presented X-Spec-Key belongs to.

    Nothing exposed this, so the UI could not tell which company it was
    actually authenticated as. The company switcher defaulted to Catalog
    while the key belonged to Client A, and every tenant-scoped read then
    came back empty — correct RLS behaviour rendered as a screen of zeros
    with nothing explaining why."""
    client = db.query(Client).filter(Client.id == key.client_id).one_or_none()
    return {
        "client_id": key.client_id,
        "client_slug": client.slug if client else None,
        "client_name": client.name if client else None,
        "key_label": key.label,
    }


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
    _rebind_tenant(db, key)
    db.refresh(new_row)

    return {
        "client_id": key.client_id,
        "key": new_plaintext,
        "key_id": new_row.id,
        "old_key_id": key.id,
        "old_key_expires_at": key.expires_at.isoformat(),
    }
