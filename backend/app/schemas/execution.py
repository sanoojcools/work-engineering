from datetime import datetime

from pydantic import BaseModel, Field

from ..models.execution import CheckType, SpecCheckResult
from ..models.verification import ChangeKind, VerificationOutcome
from ..models.workunit import ActorType, VerificationMethod


class VerificationRunCreate(BaseModel):
    work_unit_id: int
    method: VerificationMethod
    independent: bool = True
    outcome: VerificationOutcome
    evidence_ref: str = ""
    actor_ref: str = ""
    notes: str = ""


class VerificationRunOut(BaseModel):
    id: int
    work_unit_id: int
    method: VerificationMethod
    independent: bool
    outcome: VerificationOutcome
    evidence_ref: str
    actor_ref: str
    notes: str
    ran_at: datetime

    model_config = {"from_attributes": True}


class AutonomyChangeOut(BaseModel):
    id: int
    work_unit_id: int
    kind: ChangeKind
    from_level: int
    to_level: int
    reason: str
    approved_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SpecCheckIn(BaseModel):
    work_unit_code: str
    check_type: CheckType
    caller: str = "execution"
    approver: str = ""
    actor: str = ""
    evidence_ref: str = ""
    object_state: str = ""


class SpecCheckOut(BaseModel):
    id: int
    work_unit_id: int
    check_type: CheckType
    result: SpecCheckResult
    reason: str
    caller: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TrajectoryIn(BaseModel):
    work_unit_code: str
    actor_type: ActorType = ActorType.agent
    actor_ref: str = ""
    steps: str = "[]"
    llm_judge_score: float | None = Field(default=None, ge=0, le=1)
    flagged: bool = False


class TrajectoryOut(BaseModel):
    id: int
    work_unit_id: int
    actor_type: ActorType
    actor_ref: str
    steps: str
    llm_judge_score: float | None
    flagged: bool
    created_at: datetime

    model_config = {"from_attributes": True}
