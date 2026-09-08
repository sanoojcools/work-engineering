"""V10-3 contract (docs/contracts/v10-3-verify.md): upsert-on-write for
verification design and certification.

Certification's one enforced rule (contract, verbatim): "class=sure
rejected if any binding field pointer status is predicted or composed
(422)." NOT scoped to services/pointers.py's own BINDING_FIELDS
(authority, acceptance_criteria, actor_constraints): that V10-2 rule
already forces a binding field to be `declared` or absent -- predicted and
composed are both REJECTED outright for a binding field at write time, so
a check scoped to BINDING_FIELDS could never fire through this app's own
API and the contract's own required test ("certification.class=sure +
predicted pointer -> 422", no binding-field qualifier) would be
unreachable. Read literally instead: any of this unit's field pointers,
on any field, standing at predicted (a guess, no verifiable backing) or
composed (a person's judgement, not a quote) blocks "sure" -- both are
this codebase's own definition of "not something to stake a sure claim
on." A unit with zero pointers at all may still be certified "sure."
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.pointers import FieldPointer, PointerStatus
from ..models.verification_design import Certification, CertificationClass, VerificationDesign
from ..models.workunit import WorkUnit

_BLOCKS_SURE = (PointerStatus.predicted, PointerStatus.composed)


def _has_blocking_pointer(db: Session, work_unit_id: int) -> bool:
    return (
        db.query(FieldPointer)
        .filter(
            FieldPointer.work_unit_id == work_unit_id,
            FieldPointer.status.in_(_BLOCKS_SURE),
        )
        .first()
        is not None
    )


def upsert_design(db: Session, wu: WorkUnit, payload: dict) -> VerificationDesign:
    row = db.query(VerificationDesign).filter(VerificationDesign.work_unit_id == wu.id).one_or_none()
    if row is None:
        row = VerificationDesign(work_unit_id=wu.id)
        db.add(row)
    for field, value in payload.items():
        setattr(row, field, value)
    row.dual_track = True  # structural, never caller-set -- see model docstring
    db.commit()
    db.refresh(row)
    return row


def upsert_certification(db: Session, wu: WorkUnit, cert_class: CertificationClass) -> Certification:
    if cert_class == CertificationClass.sure and _has_blocking_pointer(db, wu.id):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "certification cannot be 'sure' while a field pointer stands at predicted or composed",
        )
    row = db.query(Certification).filter(Certification.work_unit_id == wu.id).one_or_none()
    if row is None:
        row = Certification(work_unit_id=wu.id)
        db.add(row)
    row.cert_class = cert_class
    db.commit()
    db.refresh(row)
    return row
