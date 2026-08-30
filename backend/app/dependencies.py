import hashlib
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from .db import get_db
from .models.security import OrgApiKey

DbDep = Annotated[Session, Depends(get_db)]

# Slice 3 PR 3a (playbook G.1): how long a rotated-out key keeps
# authenticating after POST /org/keys/rotate, so a caller mid-flight isn't
# cut off mid-rotation. Named constant, not invented per-call.
ROTATION_GRACE_MINUTES = 60


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def require_org_api_key(
    x_spec_key: str | None = Header(default=None, alias="X-Spec-Key"),
    db: Session = Depends(get_db),
) -> OrgApiKey:
    """Per-org credential (P0-3: replaces the single shared spec_api_key —
    every router is on this now as of Slice 3 PR 3a, no more legacy
    global-key path). org_api_keys carries no RLS policy on purpose —
    resolving which tenant a key belongs to has to run before
    app.current_client_id exists (see alembic 9a07306c5434's comment on
    this table). A row is valid while is_active, OR while it's the
    rotated-out previous key and still inside its expires_at grace window;
    past that it 401s like any other dead key."""
    if not x_spec_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Spec-Key")
    key_hash = hashlib.sha256(x_spec_key.encode("utf-8")).hexdigest()
    now = _utcnow()
    row = (
        db.query(OrgApiKey)
        .filter(
            OrgApiKey.key_hash == key_hash,
            or_(OrgApiKey.is_active.is_(True), OrgApiKey.expires_at > now),
        )
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or inactive API key")
    row.last_used_at = now
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
    for every route that goes through TenantDbDep — genome, files,
    work_units, spec, census, org, as of Slice 3 PR 3a. A route still on
    plain DbDep (ontology, discovery, projections, verdict, ...) has no
    per-org credential to check in the first place and never calls this
    function, so it runs on whatever app.current_client_id the pooled
    connection happens to be carrying from a prior request rather than a
    value tied to its own caller — those routers were never in PR 3a's
    scope (playbook G.1 names work_units/spec/census specifically) and
    stay that way."""
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})
    return db


TenantDbDep = Annotated[Session, Depends(tenant_db)]
