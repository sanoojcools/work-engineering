from fastapi import APIRouter, HTTPException, status

from ..dependencies import DbDep
from ..models.graph import WorkEdge
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.graph import WorkEdgeCreate, WorkEdgeOut
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/edges", response_model=Page[WorkEdgeOut])
def list_edges(db: DbDep) -> Page[WorkEdgeOut]:
    rows = db.query(WorkEdge).order_by(WorkEdge.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/edges", response_model=WorkEdgeOut, status_code=status.HTTP_201_CREATED)
def create_edge(payload: WorkEdgeCreate, db: DbDep) -> WorkEdge:
    if payload.source_id == payload.target_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A unit cannot depend on itself")
    get_or_404(db, WorkUnit, payload.source_id, "WorkUnit")
    get_or_404(db, WorkUnit, payload.target_id, "WorkUnit")
    row = WorkEdge(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_edge(edge_id: int, db: DbDep) -> None:
    row = get_or_404(db, WorkEdge, edge_id, "WorkEdge")
    db.delete(row)
    db.commit()
