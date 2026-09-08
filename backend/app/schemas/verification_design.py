"""V10-3 (docs/V10_BUILD.md): verification design + certification wire
shapes. See services/verification_design.py for what the write path
actually enforces."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from ..models.verification_design import CertificationClass, ErrorCost, IndependenceKind
from ..models.workunit import VerificationMethod


class VerificationDesignIn(BaseModel):
    method: VerificationMethod | None = None
    independence: IndependenceKind = IndependenceKind.no
    independence_required: bool = False
    sampling: str = "not stated"
    cost: float | None = None
    error_cost: ErrorCost = ErrorCost.contestable
    certification: CertificationClass = CertificationClass.cannot_define
    checked_by: str = ""
    # dual_track is deliberately NOT a field here -- see
    # models/verification_design.py's docstring: "check stays human, no
    # executor" is structural, not something a caller can set.


class VerificationDesignOut(BaseModel):
    id: int
    work_unit_id: int
    method: VerificationMethod | None
    independence: IndependenceKind
    independence_required: bool
    sampling: str
    cost: float | None
    error_cost: ErrorCost
    certification: CertificationClass
    checked_by: str
    dual_track: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
