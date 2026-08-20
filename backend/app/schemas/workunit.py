from pydantic import BaseModel, Field

from ..models.ontology import Provenance
from ..models.workunit import ActorType, UnitStatus, VerificationMethod


class WorkUnitCreate(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    business_object_type_id: int
    current_condition: str
    desired_condition: str
    context: str = ""
    trigger: str = ""
    inputs: str = ""
    authority: str = ""
    actor_constraints: str = ""
    acceptance_criteria: str = ""
    evidence_required: str = ""
    verification_method: VerificationMethod = VerificationMethod.deterministic_rule
    sla_hours: float = 0
    failure_semantics: str = ""
    regulatory_entry_id: int | None = None
    provenance: Provenance = Provenance.designed
    owner: str = ""
    actor_type: ActorType = ActorType.human
    is_sustaining: bool = False


class WorkUnitUpdate(BaseModel):
    name: str | None = None
    business_object_type_id: int | None = None
    current_condition: str | None = None
    desired_condition: str | None = None
    context: str | None = None
    trigger: str | None = None
    inputs: str | None = None
    authority: str | None = None
    actor_constraints: str | None = None
    acceptance_criteria: str | None = None
    evidence_required: str | None = None
    verification_method: VerificationMethod | None = None
    sla_hours: float | None = None
    failure_semantics: str | None = None
    regulatory_entry_id: int | None = None
    provenance: Provenance | None = None
    owner: str | None = None
    actor_type: ActorType | None = None
    is_sustaining: bool | None = None
    status: UnitStatus | None = None


class WorkUnitOut(BaseModel):
    id: int
    code: str
    name: str
    business_object_type_id: int
    current_condition: str
    desired_condition: str
    context: str
    trigger: str
    inputs: str
    authority: str
    actor_constraints: str
    acceptance_criteria: str
    evidence_required: str
    verification_method: VerificationMethod
    sla_hours: float
    failure_semantics: str
    regulatory_entry_id: int | None
    provenance: Provenance
    owner: str
    actor_type: ActorType
    status: UnitStatus
    autonomy_level: int
    is_sustaining: bool
    machine_readable: bool = False
    missing_attributes: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class VariantCreate(BaseModel):
    name: str
    overrides: str = "{}"


class VariantOut(BaseModel):
    id: int
    parent_id: int
    name: str
    overrides: str

    model_config = {"from_attributes": True}


class PromoteIn(BaseModel):
    to_level: int = Field(ge=2, le=6)
    approved_by: str = Field(min_length=1)
    reason: str = ""


class DemoteIn(BaseModel):
    to_level: int = Field(ge=1, le=5)
    reason: str = ""
