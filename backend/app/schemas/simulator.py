"""V10-13 (docs/contracts/v10-13-simulator.md): one Offer -> Day-1 case run
through the 18 leaves of packs/hr/hire_leaves.yaml, three scenarios."""
from __future__ import annotations

from pydantic import BaseModel


class SimulatedLeaf(BaseModel):
    id: str
    name: str
    band: str
    fires: str
    blocked_reason: str | None = None
    expected: str
    actual: str
    stop: bool = False


class SpecBlockOut(BaseModel):
    id: str
    reason: str


class CapacityOut(BaseModel):
    labelled: str
    stated_hours_mo: float
    defended_hours_mo: float
    if_we_ran_this: str
    peak_fte_stated: float


class SimulationOut(BaseModel):
    work_system: str
    composite: str
    scenario: str
    leaf_count: int
    leaves: list[SimulatedLeaf]
    human_must_touch: list[str]
    spec_blocks: list[SpecBlockOut]
    capacity: CapacityOut
