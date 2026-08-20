from fastapi import APIRouter, status

from ..dependencies import DbDep
from ..models.regulatory import RegulatoryEntry
from ..schemas.common import Page
from ..schemas.graph import RegulatoryCreate, RegulatoryOut
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/", response_model=Page[RegulatoryOut])
def list_entries(db: DbDep) -> Page[RegulatoryOut]:
    rows = db.query(RegulatoryEntry).order_by(RegulatoryEntry.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/", response_model=RegulatoryOut, status_code=status.HTTP_201_CREATED)
def create_entry(payload: RegulatoryCreate, db: DbDep) -> RegulatoryEntry:
    row = RegulatoryEntry(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{entry_id}", response_model=RegulatoryOut)
def get_entry(entry_id: int, db: DbDep) -> RegulatoryEntry:
    return get_or_404(db, RegulatoryEntry, entry_id, "RegulatoryEntry")
