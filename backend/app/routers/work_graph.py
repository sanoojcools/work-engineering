from fastapi import APIRouter, HTTPException, Query, status

from ..dependencies import OptionalTenantDbDep
from ..models.graph import WorkEdge
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.graph import WorkEdgeCreate, WorkEdgeOut
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/edges", response_model=Page[WorkEdgeOut])
def list_edges(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> Page[WorkEdgeOut]:
    rows = db.query(WorkEdge).order_by(WorkEdge.id).all()
    if client_id is not None:
        ids = {u.id for u in db.query(WorkUnit).filter(WorkUnit.client_id == client_id).all()}
        rows = [r for r in rows if r.source_id in ids and r.target_id in ids]
    return Page(total=len(rows), items=rows)


@router.post("/edges", response_model=WorkEdgeOut, status_code=status.HTTP_201_CREATED)
def create_edge(payload: WorkEdgeCreate, db: OptionalTenantDbDep) -> WorkEdge:
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
def delete_edge(edge_id: int, db: OptionalTenantDbDep) -> None:
    row = get_or_404(db, WorkEdge, edge_id, "WorkEdge")
    db.delete(row)
    db.commit()
