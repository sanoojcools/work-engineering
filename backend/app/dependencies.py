import hashlib
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models.security import OrgApiKey

DbDep = Annotated[Session, Depends(get_db)]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_spec_key(x_spec_key: str | None = Header(default=None, alias="X-Spec-Key")) -> str:
    """DEPRECATED single global secret, kept only so already-shipped routers
    (work_units, census, spec, etc.) keep working while they're migrated to
    require_org_api_key/TenantDbDep one at a time — that migration is real
    follow-up work, not done in this pass. New endpoints (genome import)
    use the per-org key below, never this."""
    if not x_spec_key or x_spec_key != settings.spec_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing spec API key",
        )
    return x_spec_key


SpecKeyDep = Annotated[str, Depends(require_spec_key)]


def require_org_api_key(
    x_spec_key: str | None = Header(default=None, alias="X-Spec-Key"),
    db: Session = Depends(get_db),
) -> OrgApiKey:
    """Per-org credential (P0-3: replaces the single shared spec_api_key).
    org_api_keys carries no RLS policy on purpose — resolving which tenant a
    key belongs to has to run before app.current_client_id exists (see
    alembic 9a07306c5434's comment on this table)."""
    if not x_spec_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Spec-Key")
    key_hash = hashlib.sha256(x_spec_key.encode("utf-8")).hexdigest()
    row = (
        db.query(OrgApiKey)
        .filter(OrgApiKey.key_hash == key_hash, OrgApiKey.is_active.is_(True))
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or inactive API key")
    row.last_used_at = _utcnow()
    db.commit()
    return row


OrgKeyDep = Annotated[OrgApiKey, Depends(require_org_api_key)]


def tenant_db(
    key: OrgApiKey = Depends(require_org_api_key),
    db: Session = Depends(get_db),
) -> Session:
    """RLS-scoped session for one request.

    Deliberately SET, not SET LOCAL: service functions (apply_verdict,
    genome_import's multi-commit flow) call db.commit() more than once per
    request, and SET LOCAL reverts at the end of EVERY transaction — a
    genuine bug caught live (verdict application after the first commit lost
    tenant scoping entirely, breaking db.refresh() under RLS). SET persists
    for the life of the underlying connection, so every tenant-scoped
    request re-issues it fresh here before any query runs, overwriting
    whatever a previous request left on a pooled connection. This is safe
    for every route that goes through TenantDbDep; a route still using the
    legacy DbDep/SpecKeyDep pattern never sets this variable at all, so RLS
    fails closed (0 rows) for it rather than leaking another tenant's data —
    but closing that gap for good means finishing the SpecKeyDep ->
    TenantDbDep router migration flagged in require_spec_key's docstring."""
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})
    return db


TenantDbDep = Annotated[Session, Depends(tenant_db)]
