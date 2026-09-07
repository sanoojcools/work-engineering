from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.ontology import Provenance
from ..models.verdict import VerdictScore
from ..models.workunit import UnitStatus, WorkUnit, WorkUnitVariant
from ..schemas.workunit import WorkUnitCreate, WorkUnitOut, WorkUnitUpdate
from . import promotion, verdict as verdict_svc
from .contract import evidence_path_exists, machine_readable, missing_attributes
from .errors import ConflictError, RuleError
from .verdict import PROPERTIES, persist_derivation, scores_from_orm


def to_out(wu: WorkUnit) -> WorkUnitOut:
    data = WorkUnitOut.model_validate(wu)
    missing = missing_attributes(wu)
    return data.model_copy(update={
        "machine_readable": not missing,
        "missing_attributes": missing,
    })


def create_unit(db: Session, payload: WorkUnitCreate) -> WorkUnit:
    from .tenants import get_or_create_catalog

    data = payload.model_dump()
    if not data.get("client_id"):
        data["client_id"] = get_or_create_catalog(db).id
    wu = WorkUnit(**data)
    db.add(wu)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(f"Work Unit code '{payload.code}' already exists in this company") from exc
    db.refresh(wu)
    return wu


def update_unit(db: Session, wu: WorkUnit, payload: WorkUnitUpdate) -> WorkUnit:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wu, field, value)
    db.commit()
    db.refresh(wu)
    return wu


def apply_verdict(db: Session, wu: WorkUnit, scores: dict, origin: str = "confirmed") -> VerdictScore:
    licensed = bool(wu.regulatory_entry and wu.regulatory_entry.requires_licensed_human)
    result = verdict_svc.derive_autonomy(
        scores,
        requires_licensed_human=licensed,
        evidence_path_exists=evidence_path_exists(wu),
    )
    row = wu.verdict
    if row is None:
        try:
            # SAVEPOINT, not a full db.rollback(): this request's own
            # transaction opened with a plain `SET app.current_client_id`
            # (dependencies.py::optional_tenant_db/tenant_db, deliberately
            # not SET LOCAL so it survives this function's own multiple
            # commits) -- and Postgres undoes a plain SET, same as any other
            # statement, if the transaction that issued it is rolled back.
            # A full rollback here was tried first and reproduced a second,
            # worse failure live: ObjectDeletedError on the very next `wu`
            # reload, because the rollback silently dropped RLS's tenant
            # scoping and the reload then saw zero rows. A nested
            # transaction confines the rollback to just this speculative
            # insert; the outer transaction, and the SET it carries, is
            # untouched.
            with db.begin_nested():
                row = VerdictScore(work_unit_id=wu.id)
                db.add(row)
                db.flush()
        except IntegrityError:
            # PUT is an upsert; two concurrent first-time scores for the same
            # work unit both see wu.verdict as None and both try to insert.
            # verdict_scores.work_unit_id is UNIQUE, so the loser's flush
            # hits the winner's row (reproduced live: concurrent PUTs to a
            # freshly created unit 500'd with exc_type=IntegrityError before
            # this fix) -- fall back to updating that row instead of
            # surfacing a 500 for a request that was otherwise valid.
            row = db.query(VerdictScore).filter(VerdictScore.work_unit_id == wu.id).one()
    for prop in PROPERTIES:
        setattr(row, prop, result["scores"][prop])
    persist_derivation(row, result, wu.actor_type.value)
    row.origin = origin
    db.commit()
    db.refresh(row)
    db.refresh(wu)
    promotion.maybe_demote_to_recommendation(db, wu)
    db.refresh(wu)
    db.refresh(row)
    return row


def verdict_out(row: VerdictScore) -> dict:
    derived = verdict_svc.derive_autonomy(
        scores_from_orm(row),
        requires_licensed_human=bool(
            row.work_unit.regulatory_entry and row.work_unit.regulatory_entry.requires_licensed_human
        ) if row.work_unit else False,
        evidence_path_exists=evidence_path_exists(row.work_unit) if row.work_unit else True,
    )
    return {
        **{k: getattr(row, k) for k in (
            "id", "work_unit_id", *PROPERTIES, "recommended_level", "applied_gates", "allocation", "origin"
        )},
        "mean": derived["mean"],
        "uncapped_level": derived["uncapped_level"],
        "level_name": derived["level_name"],
    }


def reconcile(db: Session, wu: WorkUnit) -> WorkUnit:
    if wu.status != UnitStatus.draft:
        raise RuleError("Only draft units can be reconciled (E4)")
    wu.status = UnitStatus.reconciled
    wu.provenance = Provenance.designed if wu.provenance == Provenance.inferred else wu.provenance
    db.commit()
    db.refresh(wu)
    return wu


def make_authoritative(db: Session, wu: WorkUnit, passed_runs: int) -> WorkUnit:
    if wu.status != UnitStatus.reconciled:
        raise RuleError("Unit must be reconciled before it can become authoritative (E4)")
    if passed_runs < 1:
        raise RuleError("Authoritative status requires at least one passing verification run")
    if not machine_readable(wu):
        raise RuleError("Contract is not machine-readable; fill missing attributes first")
    wu.status = UnitStatus.authoritative
    db.commit()
    db.refresh(wu)
    return wu


def add_variant(db: Session, wu: WorkUnit, name: str, overrides: str) -> WorkUnitVariant:
    variant = WorkUnitVariant(parent_id=wu.id, name=name, overrides=overrides)
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant
