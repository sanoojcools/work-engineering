from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from ..dependencies import DbDep
from ..models.ontology import Entity, EntityEdge, EntityType
from ..schemas.common import Page
from ..schemas.ontology import (
    EntityCreate,
    EntityEdgeCreate,
    EntityEdgeOut,
    EntityOut,
    EntityTypeCreate,
    EntityTypeOut,
    EntityTypeUpdate,
    EntityUpdate,
)
from ..services.lookup import get_or_404

router = APIRouter()


@router.get("/types", response_model=Page[EntityTypeOut])
def list_types(db: DbDep) -> Page[EntityTypeOut]:
    rows = db.query(EntityType).order_by(EntityType.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/types", response_model=EntityTypeOut, status_code=status.HTTP_201_CREATED)
def create_type(payload: EntityTypeCreate, db: DbDep) -> EntityType:
    row = EntityType(**payload.model_dump())
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Entity type name already exists") from exc
    db.refresh(row)
    return row


@router.get("/types/{type_id}", response_model=EntityTypeOut)
def get_type(type_id: int, db: DbDep) -> EntityType:
    return get_or_404(db, EntityType, type_id, "EntityType")


@router.patch("/types/{type_id}", response_model=EntityTypeOut)
def patch_type(type_id: int, payload: EntityTypeUpdate, db: DbDep) -> EntityType:
    row = get_or_404(db, EntityType, type_id, "EntityType")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_type(type_id: int, db: DbDep) -> None:
    row = get_or_404(db, EntityType, type_id, "EntityType")
    db.delete(row)
    db.commit()


@router.get("/entities", response_model=Page[EntityOut])
def list_entities(db: DbDep) -> Page[EntityOut]:
    rows = db.query(Entity).order_by(Entity.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/entities", response_model=EntityOut, status_code=status.HTTP_201_CREATED)
def create_entity(payload: EntityCreate, db: DbDep) -> Entity:
    get_or_404(db, EntityType, payload.type_id, "EntityType")
    row = Entity(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/entities/{entity_id}", response_model=EntityOut)
def get_entity(entity_id: int, db: DbDep) -> Entity:
    return get_or_404(db, Entity, entity_id, "Entity")


@router.patch("/entities/{entity_id}", response_model=EntityOut)
def patch_entity(entity_id: int, payload: EntityUpdate, db: DbDep) -> Entity:
    row = get_or_404(db, Entity, entity_id, "Entity")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.get("/edges", response_model=Page[EntityEdgeOut])
def list_edges(db: DbDep) -> Page[EntityEdgeOut]:
    rows = db.query(EntityEdge).order_by(EntityEdge.id).all()
    return Page(total=len(rows), items=rows)


@router.post("/edges", response_model=EntityEdgeOut, status_code=status.HTTP_201_CREATED)
def create_edge(payload: EntityEdgeCreate, db: DbDep) -> EntityEdge:
    get_or_404(db, Entity, payload.source_id, "Entity")
    get_or_404(db, Entity, payload.target_id, "Entity")
    row = EntityEdge(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
