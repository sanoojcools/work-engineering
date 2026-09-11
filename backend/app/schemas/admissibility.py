"""V10-11 (docs/contracts/v10-11-states.md): admissibility refusals for the
Offer Desk -> Onboarding journey."""
from pydantic import BaseModel, Field


class RefusalOut(BaseModel):
    work_unit_id: int
    code: str
    reason: str  # "no_exit" | "two_owners" | "unaffordable_check"
    detail: str


class AdmissibilityOut(BaseModel):
    work_system_id: int
    refusals: list[RefusalOut] = Field(default_factory=list)
