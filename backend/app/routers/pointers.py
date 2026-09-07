"""V10-2 (docs/V10_BUILD.md): field pointer API. Backend/API only this PR --
"No new Evidence UI (Cursor after)" -- this is the surface Cursor's
Evidence click-a-claim screen will call next slice.

Deliberately a separate module from routers/work_units.py, mounted at the
same "/work-units" prefix -- same reasoning routers/censuses.py gives for
staying apart from routers/census.py: keeps this slice's diff self-
contained and independently reviewable."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.pointers import FieldPointer
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.pointers import FieldPointerIn, FieldPointerOut
from ..services import pointers as pointers_svc
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/{work_unit_id}/pointers", response_model=Page[FieldPointerOut])
def list_pointers(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> Page[FieldPointerOut]:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    rows = (
        db.query(FieldPointer)
        .filter(FieldPointer.work_unit_id == work_unit_id)
        .order_by(FieldPointer.field_name)
        .all()
    )
    return Page(total=len(rows), items=rows)


@router.get("/{work_unit_id}/pointers/{field_name}", response_model=FieldPointerOut)
def get_pointer(work_unit_id: int, field_name: str, db: TenantDbDep, key: OrgKeyDep) -> FieldPointer:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = (
        db.query(FieldPointer)
        .filter(FieldPointer.work_unit_id == work_unit_id, FieldPointer.field_name == field_name)
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No pointer recorded for field {field_name!r}")
    return row


@router.post("/{work_unit_id}/pointers", response_model=FieldPointerOut, status_code=200)
def upsert_pointer(work_unit_id: int, payload: FieldPointerIn, db: TenantDbDep, key: OrgKeyDep) -> FieldPointer:
    """Upsert-by-(work_unit_id, field_name). Always 200, never 201: this is
    the resolver's entry point, and every call re-resolves against the
    file's current content, whether or not a row already existed for this
    field (services/pointers.py::upsert_field_pointer)."""
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return pointers_svc.upsert_field_pointer(
        db, wu,
        field_name=payload.field_name,
        requested_status=payload.status,
        file_id=payload.file_id,
        page=payload.page,
        line=payload.line,
        cell=payload.cell,
        quote=payload.quote,
    )
