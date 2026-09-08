"""V10-3 contract (docs/contracts/v10-3-verify.md): verification design +
certification wire shapes. `class` is the contract's own wire name for
certification's one field; `cert_class` is the Python attribute (`class`
is a keyword), aliased both ways so the JSON body reads exactly as the
contract specifies."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models.verification_design import CertificationClass, IndependenceKind, VerificationDesignMethod


class VerificationDesignIn(BaseModel):
    method: VerificationDesignMethod = VerificationDesignMethod.none
    independent: IndependenceKind = IndependenceKind.not_stated
    sampling: str | None = None
    cost_of_check: str | None = None
    # dual_track is deliberately NOT a field here -- structural, see
    # models/verification_design.py's docstring: "never starts an agent."


class VerificationDesignOut(BaseModel):
    id: int
    work_unit_id: int
    method: VerificationDesignMethod
    independent: IndependenceKind
    sampling: str | None
    cost_of_check: str | None
    dual_track: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CertificationIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    cert_class: CertificationClass = Field(default=CertificationClass.cannot_define, alias="class")


class CertificationOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
    id: int
    work_unit_id: int
    cert_class: CertificationClass = Field(alias="class")
    created_at: datetime
    updated_at: datetime
