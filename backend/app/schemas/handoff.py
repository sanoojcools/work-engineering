"""P2 -- Handoff completeness (docs/BUILD_PROGRAM.md CENSUS-PACK). See
services/handoff.py for the rule this shape carries the result of.

V10-14 (docs/contracts/v10-14-handoff.md) extends `bundle` from a bare
WorkUnitOut into a record + actor_policy + gates + validator_spec +
scenario + provenance pack, on the same route via `?view=governor|performer`.
Existing callers reading `bundle` as a work-unit-shaped object move to
`bundle.record` -- named in the contract as this slice's own migration, not
a surprise."""
from pydantic import BaseModel, Field

from .workunit import WorkUnitOut


class ActorPolicyOut(BaseModel):
    cap: str
    owner: str


class ValidatorSpecOut(BaseModel):
    method: str
    independent: str


class ScenarioOut(BaseModel):
    # All null on `view=performer` -- keys stay present so the shape is
    # stable across views, the values are withheld (contract, verbatim).
    careful: int | None = None
    as_calculated: int | None = None
    ambitious: int | None = None
    cap: int | None = None


class ProvenanceOut(BaseModel):
    source: str
    composed: bool


class HandoffBundleOut(BaseModel):
    # WorkUnitOut without verdict scores -- it never carried recommended_level
    # or raw VERDICT properties to begin with, so this is the same shape on
    # both views; only `scenario` differs.
    record: WorkUnitOut
    actor_policy: ActorPolicyOut
    gates: list[str]
    validator_spec: ValidatorSpecOut
    scenario: ScenarioOut
    provenance: ProvenanceOut


class HandoffOut(BaseModel):
    work_unit_code: str
    ready: bool
    reasons: list[str] = Field(default_factory=list)
    verification_method: str | None = None
    # None: not yet scored, so gates are unknown -- distinct from an empty
    # list, which means scored with zero hard gates applied.
    gates: list[str] | None = None
    dual_employment_stop_required: bool = False
    # V10-3's 5th gate -- true when an independent check is required (either
    # a human said so on this unit's verification_design, or VERDICT's own
    # intent is unconfirmed, non-waivably) and none is recorded.
    independent_check_required: bool = False
    # Only populated when ready -- a refused unit gets a reason, not a
    # contract "here anyway" (P2: "must refuse a bundle if not ready").
    bundle: HandoffBundleOut | None = None
