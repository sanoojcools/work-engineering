"""V10-8 (docs/contracts/v10-8-field-ratify.md): draft-beside-the-quote,
confirm/correct writes the field, decision cards read existing gaps only.

Quote rule on create (contract, verbatim): if a `declared` field_pointers
row exists for this unit+field, `sitting_quote` must be a literal substring
of that pointer's quote (422 otherwise); else the quote is stored as given.
No LLM call, no invented pointer -- see models/pointers.py for the field
pointer this checks against.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.discovery import ConformanceGap
from ..models.field_ratification import FieldRatification, FieldRatificationStatus
from ..models.pointers import FieldPointer, PointerStatus
from ..models.security import AuditLog
from ..models.workunit import WorkUnit
from .genome_import import _clip

# work_units.desired_condition is VARCHAR(80) by design (see genome_import._clip);
# authority/acceptance_criteria are Text and need no clipping.
_CLIPPED_FIELDS = frozenset({"desired_condition"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_draft(
    db: Session,
    work_unit: WorkUnit,
    key,
    *,
    field_name: str,
    sitting_quote: str,
    drafted_value: str,
) -> FieldRatification:
    existing = (
        db.query(FieldRatification)
        .filter(
            FieldRatification.work_unit_id == work_unit.id,
            FieldRatification.field_name == field_name,
        )
        .one_or_none()
    )
    if existing is not None:
        if existing.status != FieldRatificationStatus.drafted:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"field_ratification for {field_name!r} is already {existing.status.value}",
            )
        # Get-or-create: never overwrite a standing draft with a later
        # caller's quote/value (same idiom as work_systems' ensure).
        return existing

    pointer = (
        db.query(FieldPointer)
        .filter(
            FieldPointer.work_unit_id == work_unit.id,
            FieldPointer.field_name == field_name,
            FieldPointer.status == PointerStatus.declared,
        )
        .one_or_none()
    )
    if pointer is not None and sitting_quote not in pointer.quote:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"sitting_quote must be a literal substring of the declared field_pointers quote for {field_name!r}",
        )

    row = FieldRatification(
        client_id=key.client_id,
        work_unit_id=work_unit.id,
        field_name=field_name,
        sitting_quote=sitting_quote,
        drafted_value=drafted_value,
        status=FieldRatificationStatus.drafted,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def confirm_or_correct(
    db: Session,
    work_unit: WorkUnit,
    row: FieldRatification,
    key,
    *,
    action: str,
    confirmed_by: str,
    value: str | None,
) -> FieldRatification:
    if row.status != FieldRatificationStatus.drafted:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"field_ratification {row.id} is already {row.status.value}",
        )

    if action == "confirm":
        confirmed_value = row.drafted_value
        new_status = FieldRatificationStatus.confirmed
    else:  # "correct"
        if value is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "value is required for action=correct")
        if value == row.drafted_value:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "correct requires a value that differs from drafted_value",
            )
        confirmed_value = value
        new_status = FieldRatificationStatus.corrected

    field_name = row.field_name.value
    write_value = _clip(confirmed_value, 80) if field_name in _CLIPPED_FIELDS else confirmed_value
    setattr(work_unit, field_name, write_value)

    row.confirmed_value = confirmed_value
    row.status = new_status
    row.confirmed_by = confirmed_by
    row.confirmed_at = _utcnow()

    db.add(AuditLog(
        client_id=key.client_id, actor=key.label or f"org_api_key:{key.id}",
        action=f"field_ratification.{action}", resource="field_ratification", resource_id=str(row.id),
        detail=f"work_unit_id={work_unit.id} field_name={field_name} confirmed_by={confirmed_by}",
    ))
    db.commit()
    db.refresh(row)
    return row


def decision_cards(db: Session, work_unit: WorkUnit) -> list[dict]:
    """One card per existing conformance_gaps row on this unit -- no new
    GapKind, no invented pairing to a field (contract: 'Cursor will pair
    cards to fields later'). Empty list is honest."""
    gaps = (
        db.query(ConformanceGap)
        .filter(ConformanceGap.work_unit_id == work_unit.id)
        .order_by(ConformanceGap.id)
        .all()
    )
    named_human = work_unit.owner if work_unit.owner else "not named"
    return [
        {
            "gap_id": g.id,
            "kind": g.kind.value,
            "description": g.description,
            "named_human": named_human,
            "action": "confirm_or_correct",
        }
        for g in gaps
    ]
