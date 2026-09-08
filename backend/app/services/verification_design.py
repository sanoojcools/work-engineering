"""V10-3 (docs/V10_BUILD.md): upsert-on-write for verification_design +
certification.

The one enforced cross-check, named directly in the work order
("predicted provenance cannot become 'sure'" -- BUILD_PROGRAM.md, though
the value in question is actually models/pointers.py's PointerStatus, not
models/ontology.py's Provenance; see that module's docstring for why the
two are distinct): certification cannot be written as "sure" while any of
this unit's field pointers (V10-2) stands at "predicted". A predicted
pointer is this codebase's own definition of "no verifiable backing" --
letting a unit be certified "sure" anyway would be exactly the kind of
stronger-claim-than-the-evidence-supports move services/pointers.py
already refuses for binding fields.

This is the only guard here. It does not require any pointer exist at all,
and does not touch independence, method, sampling, or cost -- those are
recorded as stated, same discipline services/pointers.py applies to
sampling/cost being allowed to just say "not stated" rather than inventing
a value.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.pointers import FieldPointer, PointerStatus
from ..models.verification_design import CertificationClass, VerificationDesign
from ..models.workunit import WorkUnit


def _has_predicted_pointer(db: Session, work_unit_id: int) -> bool:
    return (
        db.query(FieldPointer)
        .filter(FieldPointer.work_unit_id == work_unit_id, FieldPointer.status == PointerStatus.predicted)
        .first()
        is not None
    )


def upsert_design(db: Session, wu: WorkUnit, payload: dict) -> VerificationDesign:
    if payload.get("certification") == CertificationClass.sure and _has_predicted_pointer(db, wu.id):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "certification cannot be 'sure' while this unit has a predicted (unverifiable) field pointer",
        )

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
