"""Slice 3 PR 3a: moved off the old no-auth DbDep onto per-org X-Spec-Key
(OrgKeyDep/TenantDbDep) — the same credential genome import and files
already use. Every write is scoped to the calling key's own client_id;
a caller-supplied client_id is never trusted (matches genome import's
key.client_id-only writes)."""
from fastapi import APIRouter, Query, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.verification import VerificationOutcome, VerificationRun
from ..models.workunit import WorkUnit, WorkUnitVariant
from ..schemas.common import Page
from ..schemas.execution import AutonomyChangeOut
from ..schemas.workunit import (
    DemoteIn,
    PromoteIn,
    VariantCreate,
    VariantOut,
    WorkUnitCreate,
    WorkUnitOut,
    WorkUnitUpdate,
)
from ..services import promotion, work_units as wu_svc
from ..services.errors import ConflictError, RuleError
from ..services.lookup import get_or_404, http_rule

router = APIRouter()


@router.get("/", response_model=Page[WorkUnitOut])
def list_work_units(db: TenantDbDep, key: OrgKeyDep, client_id: int | None = Query(default=None)) -> Page[WorkUnitOut]:
    q = db.query(WorkUnit)
    if client_id is not None:
        q = q.filter(WorkUnit.client_id == client_id)
    rows = q.order_by(WorkUnit.id).all()
    return Page(total=len(rows), items=[wu_svc.to_out(r) for r in rows])


@router.post("/", response_model=WorkUnitOut, status_code=status.HTTP_201_CREATED)
def create_work_unit(payload: WorkUnitCreate, db: TenantDbDep, key: OrgKeyDep) -> WorkUnitOut:
    payload = payload.model_copy(update={"client_id": key.client_id})
    try:
        wu = wu_svc.create_unit(db, payload)
    except ConflictError as exc:
        raise http_rule(exc) from exc
    return wu_svc.to_out(wu)


@router.get("/{work_unit_id}", response_model=WorkUnitOut)
def get_work_unit(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> WorkUnitOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return wu_svc.to_out(wu)


@router.patch("/{work_unit_id}", response_model=WorkUnitOut)
def patch_work_unit(work_unit_id: int, payload: WorkUnitUpdate, db: TenantDbDep, key: OrgKeyDep) -> WorkUnitOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return wu_svc.to_out(wu_svc.update_unit(db, wu, payload))


@router.delete("/{work_unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_unit(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> None:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    db.delete(wu)
    db.commit()


@router.post("/{work_unit_id}/reconcile", response_model=WorkUnitOut)
def reconcile(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> WorkUnitOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    try:
        return wu_svc.to_out(wu_svc.reconcile(db, wu))
    except RuleError as exc:
        raise http_rule(exc) from exc


@router.post("/{work_unit_id}/authoritative", response_model=WorkUnitOut)
def authoritative(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> WorkUnitOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    passed = (
        db.query(VerificationRun)
        .filter(
            VerificationRun.work_unit_id == wu.id,
            VerificationRun.outcome == VerificationOutcome.passed,
        )
        .count()
    )
    try:
        return wu_svc.to_out(wu_svc.make_authoritative(db, wu, passed))
    except RuleError as exc:
        raise http_rule(exc) from exc


@router.post("/{work_unit_id}/variants", response_model=VariantOut, status_code=status.HTTP_201_CREATED)
def create_variant(work_unit_id: int, payload: VariantCreate, db: TenantDbDep, key: OrgKeyDep) -> WorkUnitVariant:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    return wu_svc.add_variant(db, wu, payload.name, payload.overrides)


@router.get("/{work_unit_id}/variants", response_model=Page[VariantOut])
def list_variants(work_unit_id: int, db: TenantDbDep, key: OrgKeyDep) -> Page[VariantOut]:
    get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    rows = db.query(WorkUnitVariant).filter(WorkUnitVariant.parent_id == work_unit_id).all()
    return Page(total=len(rows), items=rows)


@router.post("/{work_unit_id}/promote", response_model=AutonomyChangeOut)
def promote(work_unit_id: int, payload: PromoteIn, db: TenantDbDep, key: OrgKeyDep) -> AutonomyChangeOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    try:
        return promotion.promote(db, wu, payload.to_level, payload.approved_by, payload.reason)
    except RuleError as exc:
        raise http_rule(exc) from exc


@router.post("/{work_unit_id}/demote", response_model=AutonomyChangeOut)
def demote(work_unit_id: int, payload: DemoteIn, db: TenantDbDep, key: OrgKeyDep) -> AutonomyChangeOut:
    wu = get_or_404(db, WorkUnit, work_unit_id, "WorkUnit")
    try:
        return promotion.demote(db, wu, payload.to_level, payload.reason)
    except RuleError as exc:
        raise http_rule(exc) from exc
