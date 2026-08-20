from pydantic import BaseModel, Field

from ..models.ontology import EntityKind, Provenance, RelationKind


class EntityTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: EntityKind
    description: str = ""
    state_machine: str = "[]"


class EntityTypeUpdate(BaseModel):
    name: str | None = None
    kind: EntityKind | None = None
    description: str | None = None
    state_machine: str | None = None


class EntityTypeOut(BaseModel):
    id: int
    name: str
    kind: EntityKind
    description: str
    state_machine: str

    model_config = {"from_attributes": True}


class EntityCreate(BaseModel):
    type_id: int
    external_ref: str = ""
    current_state: str = ""
    provenance: Provenance = Provenance.observed


class EntityUpdate(BaseModel):
    type_id: int | None = None
    external_ref: str | None = None
    current_state: str | None = None
    provenance: Provenance | None = None


class EntityOut(BaseModel):
    id: int
    type_id: int
    external_ref: str
    current_state: str
    provenance: Provenance

    model_config = {"from_attributes": True}


class EntityEdgeCreate(BaseModel):
    source_id: int
    target_id: int
    relation_type: str = "related_to"
    kind: RelationKind = RelationKind.structural
    provenance: Provenance = Provenance.observed


class EntityEdgeOut(BaseModel):
    id: int
    source_id: int
    target_id: int
    relation_type: str
    kind: RelationKind
    provenance: Provenance

    model_config = {"from_attributes": True}
