"""V10-8 (docs/contracts/v10-8-field-ratify.md): field ratify + decision
cards. Backend/API only -- no frontend this slice. Mounted at the same
"/work-units" prefix as routers/pointers.py, same reasoning: keeps this
slice's diff self-contained and independently reviewable."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.field_ratification import FieldRatification
from ..models.workunit import WorkUnit
from ..schemas.common import Page
from ..schemas.field_ratification import (
    DecisionCardOut,
    FieldRatificationConfirmIn,
    FieldRatificationCreateIn,
    FieldRatificationOut,
)
from ..services import field_ratification as fr_svc
from ..services.lookup import get_or_404

router = APIRouter()


def _rebind_tenant(db: TenantDbDep, key) -> None:
    # Same post-commit re-SET routers/work_systems.py relies on -- a plain
    # commit() can hand the next query a pooled connection without
    # app.current_client_id applied.
    db.execute(text("SET app.current_client_id = :cid"), {"cid": str(key.client_id)})


def _get_row_or_404(db: TenantDbDep, work_unit_id: int, rid: int) -> FieldRatification:
    row = db.get(FieldRatification, rid)
    if row is None or row.work_unit_id != work_unit_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"FieldRatification {rid} not found")
    return row


@router.get("/{work_unit_id}/field-ratifications", response_model=Page[FieldRatificationOut])
def list_field_ratifications(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> Page[FieldRatificationOut]:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    rows = (
        db.query(FieldRatification)
        .filter(FieldRatification.work_unit_id == work_unit_id)
        .order_by(FieldRatification.field_name)
        .all()
    )
    return Page(total=len(rows), items=rows)


@router.post("/{work_unit_id}/field-ratifications", response_model=FieldRatificationOut)
def create_field_ratification(
    work_unit_id: int, payload: FieldRatificationCreateIn, db: TenantDbDep, key: OrgKeyDep,
) -> FieldRatification:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = fr_svc.create_draft(
        db, wu, key,
        field_name=payload.field_name.value,
        sitting_quote=payload.sitting_quote,
        drafted_value=payload.drafted_value,
    )
    _rebind_tenant(db, key)
    return row


@router.post("/{work_unit_id}/field-ratifications/{rid}/confirm", response_model=FieldRatificationOut)
def confirm_field_ratification(
    work_unit_id: int, rid: int, payload: FieldRatificationConfirmIn, db: TenantDbDep, key: OrgKeyDep,
) -> FieldRatification:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    row = _get_row_or_404(db, work_unit_id, rid)
    row = fr_svc.confirm_or_correct(
        db, wu, row, key,
        action=payload.action, confirmed_by=payload.confirmed_by, value=payload.value,
    )
    _rebind_tenant(db, key)
    return row


@router.get("/{work_unit_id}/decision-cards", response_model=Page[DecisionCardOut])
def list_decision_cards(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> Page[DecisionCardOut]:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    cards = fr_svc.decision_cards(db, wu)
    return Page(total=len(cards), items=cards)
