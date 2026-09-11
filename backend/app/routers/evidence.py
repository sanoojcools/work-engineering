"""V10-10 (docs/contracts/v10-10-eg-lite.md): source catalogue -- "each
file connected or not," no coverage %. Reads the existing `uploaded_files`
+ `field_pointers` tables (V10-2's resolver-on-write already flags each
pointer `resolved` true/false); no new table."""
from __future__ import annotations

from sqlalchemy import func

from fastapi import APIRouter

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.pointers import FieldPointer
from ..models.security import UploadedFile
from ..schemas.evidence import EvidenceCatalogueItem, EvidenceCatalogueOut

router = APIRouter()


@router.get("/catalogue", response_model=EvidenceCatalogueOut)
def evidence_catalogue(db: TenantDbDep, key: OrgKeyDep) -> EvidenceCatalogueOut:
    files = db.query(UploadedFile).filter(UploadedFile.client_id == key.client_id).order_by(UploadedFile.id).all()
    if not files:
        return EvidenceCatalogueOut(total=0, connected=0, not_connected=0, items=[])

    counts = dict(
        db.query(FieldPointer.file_id, func.count(FieldPointer.id))
        .filter(FieldPointer.file_id.in_([f.id for f in files]))
        .group_by(FieldPointer.file_id)
        .all()
    )
    resolved_counts = dict(
        db.query(FieldPointer.file_id, func.count(FieldPointer.id))
        .filter(FieldPointer.file_id.in_([f.id for f in files]), FieldPointer.resolved.is_(True))
        .group_by(FieldPointer.file_id)
        .all()
    )

    items = []
    connected = 0
    for f in files:
        resolved_count = resolved_counts.get(f.id, 0)
        is_connected = resolved_count > 0
        if is_connected:
            connected += 1
        items.append(EvidenceCatalogueItem(
            id=f.id,
            file_name=f.file_name,
            coverage="connected" if is_connected else "not",
            pointer_count=counts.get(f.id, 0),
            resolved_count=resolved_count,
        ))

    return EvidenceCatalogueOut(
        total=len(items), connected=connected, not_connected=len(items) - connected, items=items,
    )
