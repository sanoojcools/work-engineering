"""V10-11 (docs/contracts/v10-11-states.md): named before/after states for a
business object, read straight off real work_units."""
from pydantic import BaseModel, Field


class ObjectStateItem(BaseModel):
    name: str
    kind: str  # "before" | "after" | "both"


class ObjectStatesOut(BaseModel):
    object: str
    states: list[ObjectStateItem] = Field(default_factory=list)
    empty: bool
