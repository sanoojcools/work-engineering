"""V10-10 (docs/contracts/v10-10-eg-lite.md): source catalogue -- "each
file this tenant has, connected or not." No coverage percentage: a file is
either backing at least one resolved pointer, or it is not."""
from pydantic import BaseModel, Field


class EvidenceCatalogueItem(BaseModel):
    id: int
    file_name: str
    coverage: str  # "connected" | "not"
    pointer_count: int
    resolved_count: int


class EvidenceCatalogueOut(BaseModel):
    total: int
    connected: int
    not_connected: int = Field(serialization_alias="not")
    items: list[EvidenceCatalogueItem]

    model_config = {"populate_by_name": True}
