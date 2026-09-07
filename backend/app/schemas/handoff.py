"""P2 -- Handoff completeness (docs/BUILD_PROGRAM.md CENSUS-PACK). See
services/handoff.py for the rule this shape carries the result of."""
from pydantic import BaseModel, Field

from .workunit import WorkUnitOut


class HandoffOut(BaseModel):
    work_unit_code: str
    ready: bool
    reasons: list[str] = Field(default_factory=list)
    verification_method: str | None = None
    # None: not yet scored, so gates are unknown -- distinct from an empty
    # list, which means scored with zero hard gates applied.
    gates: list[str] | None = None
    dual_employment_stop_required: bool = False
    # Only populated when ready -- a refused unit gets a reason, not a
    # contract "here anyway" (P2: "must refuse a bundle if not ready").
    bundle: WorkUnitOut | None = None
