from pydantic import BaseModel, Field

from ..models.graph import EdgeType


class WorkEdgeCreate(BaseModel):
    source_id: int
    target_id: int
    edge_type: EdgeType = EdgeType.sequence


class WorkEdgeOut(BaseModel):
    id: int
    source_id: int
    target_id: int
    edge_type: EdgeType

    model_config = {"from_attributes": True}


class VerdictIn(BaseModel):
    verifiability: int = Field(ge=1, le=5)
    evidence: int = Field(ge=1, le=5)
    reversibility: int = Field(ge=1, le=5)
    determinism: int = Field(ge=1, le=5)
    impact_scope: int = Field(ge=1, le=5)
    compliance: int = Field(ge=1, le=5)
    tacitness: int = Field(ge=1, le=5)


class VerdictOut(BaseModel):
    id: int
    work_unit_id: int
    verifiability: int
    evidence: int
    reversibility: int
    determinism: int
    impact_scope: int
    compliance: int
    tacitness: int
    recommended_level: int
    applied_gates: str
    allocation: str
    origin: str = "confirmed"
    mean: float | None = None
    uncapped_level: int | None = None
    level_name: str | None = None

    model_config = {"from_attributes": True}


class CostIn(BaseModel):
    executions_per_month: float = 0
    minutes_per_execution: float = 0
    verification_minutes: float = 0
    failure_rate: float = Field(default=0, ge=0, le=1)
    exception_minutes: float = 0
    maintenance_hours: float = 0
    attribution_confidence: float = Field(default=1, ge=0, le=1)


class CostOut(BaseModel):
    id: int
    work_unit_id: int
    executions_per_month: float
    minutes_per_execution: float
    verification_minutes: float
    failure_rate: float
    exception_minutes: float
    maintenance_hours: float
    attribution_confidence: float
    origin: str = "confirmed"
    computed: dict | None = None

    model_config = {"from_attributes": True}


class RegulatoryCreate(BaseModel):
    regulation: str
    clause: str = ""
    control_objective: str = ""
    requires_licensed_human: bool = False


class RegulatoryOut(BaseModel):
    id: int
    regulation: str
    clause: str
    control_objective: str
    requires_licensed_human: bool

    model_config = {"from_attributes": True}
