"""E -- PLAN, moderation log (docs/BUILD_PROGRAM.md). A real, persisted log
of "move this unit's S2 toward S3" requests -- reason and name are required
by the schema (422 without either), and every entry is appended, never
edited or deleted. This never writes to verdict_scores or work_units: it is
an opinion about a scenario replay, not the VERDICT promotion ladder, and it
cannot lift the dual-employment stop or any hard gate -- see
models/moderation.py's own docstring."""
from __future__ import annotations

from sqlalchemy import text

from fastapi import APIRouter

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.moderation import ModerationEntry
from ..models.security import AuditLog
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.moderation import ModerationEntryIn, ModerationEntryOut
from ..services.lookup import get_by_code_or_404

router = APIRouter()


def _rebind_tenant(db: TenantDbDep, key) -> None:
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})


def _to_out(row: ModerationEntry) -> ModerationEntryOut:
    return ModerationEntryOut(
        id=row.id,
        work_unit_code=row.work_unit_code,
        from_level=row.from_level,
        to_level=row.to_level,
        reason=row.reason,
        moderated_by=row.moderated_by,
        created_at=row.created_at,
    )


@router.get("", response_model=Page[ModerationEntryOut])
def list_moderation_entries(db: TenantDbDep, key: OrgKeyDep) -> Page[ModerationEntryOut]:
    rows = db.query(ModerationEntry).order_by(ModerationEntry.created_at.desc(), ModerationEntry.id.desc()).all()
    return Page(total=len(rows), items=[_to_out(r) for r in rows])


@router.post("", response_model=ModerationEntryOut, status_code=201)
def create_moderation_entry(payload: ModerationEntryIn, db: TenantDbDep, key: OrgKeyDep) -> ModerationEntryOut:
    # Real Work Unit on this tenant, not a free-typed code -- 404 rather
    # than silently logging an opinion about a unit that doesn't exist here.
    get_by_code_or_404(db, WorkUnit, payload.work_unit_code)

    row = ModerationEntry(
        client_id=key.client_id,
        work_unit_code=payload.work_unit_code,
        from_level=payload.from_level,
        to_level=payload.to_level,
        reason=payload.reason,
        moderated_by=payload.moderated_by,
    )
    db.add(row)
    db.flush()
    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action="moderation.create", resource="work_unit", resource_id=payload.work_unit_code,
        detail=f"S2(L{payload.from_level})->S3(L{payload.to_level}) by {payload.moderated_by}: {payload.reason}",
    ))
    db.commit()
    _rebind_tenant(db, key)
    db.refresh(row)
    return _to_out(row)
