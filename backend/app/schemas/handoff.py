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
    # V10-3's 5th gate -- true when an independent check is required (either
    # a human said so on this unit's verification_design, or VERDICT's own
    # intent is unconfirmed, non-waivably) and none is recorded.
    independent_check_required: bool = False
    # Only populated when ready -- a refused unit gets a reason, not a
    # contract "here anyway" (P2: "must refuse a bundle if not ready").
    bundle: WorkUnitOut | None = None
