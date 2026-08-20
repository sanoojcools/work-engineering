from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    total: int
    items: list[T] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    version: str
    db_ready: bool
