"""Order-to-cash census seed (V8 F1 / J1). Idempotent: skips if WU-OTC-01 exists.

Run from backend/:  python -m app.seed
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine
from . import models as _models  # noqa: F401
from .models.economics import CostProfile
from .models.graph import EdgeType, WorkEdge
from .models.ontology import EntityKind, EntityType, Provenance
from .models.regulatory import RegulatoryEntry
from .models.verdict import VerdictScore
from .models.workunit import (
    ActorType,
    UnitStatus,
    VerificationMethod,
    WorkUnit,
    WorkUnitVariant,
)
from .services import verdict as verdict_svc
from .services.contract import evidence_path_exists
from .services.tenants import get_or_create_catalog
from .services.verdict import persist_derivation

UNITS = [
    # code, name, object, from, to, method, owner, actor, sla
    ("WU-OTC-01", "Capture customer order", "Order", "new", "draft",
     VerificationMethod.database_constraint, "Order Desk", ActorType.human, 4),
    ("WU-OTC-02", "Validate order", "Order", "draft", "validated",
     VerificationMethod.deterministic_rule, "Order Desk", ActorType.human, 4),
    ("WU-OTC-03", "Check credit", "Customer", "unreviewed", "credit_cleared",
     VerificationMethod.database_constraint, "Credit Controller", ActorType.human, 8),
    ("WU-OTC-04", "Commit supply", "Order", "validated", "committed",
     VerificationMethod.database_constraint, "Supply Planner", ActorType.human, 8),
    ("WU-OTC-05", "Resolve supply shortfall", "Order", "short", "committed",
     VerificationMethod.human_spot_check, "Supply Planner", ActorType.human, 24),
    ("WU-OTC-06", "Confirm delivery schedule", "Order", "committed", "scheduled",
     VerificationMethod.counterparty_confirmation, "Customer Service", ActorType.human, 8),
    ("WU-OTC-07", "Establish billing", "Invoice", "none", "draft",
     VerificationMethod.deterministic_rule, "Billing", ActorType.deterministic, 4),
    ("WU-OTC-08", "Issue invoice", "Invoice", "draft", "issued",
     VerificationMethod.database_constraint, "Billing", ActorType.deterministic, 4),
    ("WU-OTC-09", "Apply cash", "Payment", "unapplied", "applied",
     VerificationMethod.cross_system_reconciliation, "Cash Applications", ActorType.human, 8),
    ("WU-OTC-10", "Match remittance", "Payment", "unmatched", "matched",
     VerificationMethod.llm_as_judge, "Cash Applications", ActorType.agent, 8),
    ("WU-OTC-11", "Resolve receivable exception", "ReceivableException", "open", "resolved",
     VerificationMethod.human_spot_check, "Credit Controller", ActorType.human, 48),
    ("WU-OTC-12", "Write off uncollectable", "Invoice", "issued", "written_off",
     VerificationMethod.human_spot_check, "CFO", ActorType.human, 72),
    ("WU-OTC-13", "Release credit hold", "Order", "held", "validated",
     VerificationMethod.database_constraint, "Credit Controller", ActorType.human, 8),
    ("WU-OTC-14", "Update customer master", "Customer", "stale", "current",
     VerificationMethod.human_spot_check, "Master Data", ActorType.human, 24),
    ("WU-OTC-15", "Confirm proof of delivery", "Order", "shipped", "delivered",
     VerificationMethod.counterparty_confirmation, "Customer Service", ActorType.human, 24),
    ("WU-OTC-16", "Close order", "Order", "delivered", "fulfilled",
     VerificationMethod.database_constraint, "Order Desk", ActorType.deterministic, 4),
]

EDGES = [
    ("WU-OTC-01", "WU-OTC-02", EdgeType.sequence),
    ("WU-OTC-02", "WU-OTC-03", EdgeType.sequence),
    ("WU-OTC-03", "WU-OTC-04", EdgeType.sequence),
    ("WU-OTC-04", "WU-OTC-05", EdgeType.shared_object),
    ("WU-OTC-04", "WU-OTC-06", EdgeType.sequence),
    ("WU-OTC-06", "WU-OTC-07", EdgeType.sequence),
    ("WU-OTC-07", "WU-OTC-08", EdgeType.sequence),
    ("WU-OTC-08", "WU-OTC-09", EdgeType.sequence),
    ("WU-OTC-09", "WU-OTC-10", EdgeType.shared_object),
    ("WU-OTC-10", "WU-OTC-11", EdgeType.sequence),
    ("WU-OTC-11", "WU-OTC-12", EdgeType.shared_object),
    ("WU-OTC-03", "WU-OTC-13", EdgeType.sequence),
    ("WU-OTC-15", "WU-OTC-16", EdgeType.sequence),
    ("WU-OTC-08", "WU-OTC-15", EdgeType.shared_object),
]


def seed(db: Session) -> None:
    if db.query(WorkUnit).filter(WorkUnit.code == "WU-OTC-01").one_or_none():
        return

    catalog = get_or_create_catalog(db)

    order = EntityType(
        name="Order",
        kind=EntityKind.business_object,
        description="Customer sales order",
        state_machine='["new","draft","validated","held","short","committed","scheduled","shipped","delivered","fulfilled"]',
    )
    invoice = EntityType(
        name="Invoice",
        kind=EntityKind.business_object,
        description="Receivable invoice",
        state_machine='["none","draft","issued","written_off"]',
    )
    payment = EntityType(
        name="Payment",
        kind=EntityKind.business_object,
        description="Incoming cash",
        state_machine='["unapplied","unmatched","applied","matched"]',
    )
    exception = EntityType(
        name="ReceivableException",
        kind=EntityKind.business_object,
        description="Disputed or unmatched receivable",
        state_machine='["open","resolved"]',
    )
    customer = EntityType(
        name="Customer",
        kind=EntityKind.business_object,
        description="Customer master",
        state_machine='["unreviewed","credit_cleared","stale","current"]',
    )
    db.add_all([order, invoice, payment, exception, customer])
    db.flush()
    types = {t.name: t for t in (order, invoice, payment, exception, customer)}

    sox = RegulatoryEntry(
        regulation="SOX",
        clause="Section 404",
        control_objective="Write-offs of receivables require licensed finance authority",
        requires_licensed_human=True,
    )
    db.add(sox)
    db.flush()

    by_code: dict[str, WorkUnit] = {}
    for code, name, obj, pre, post, method, owner, actor, sla in UNITS:
        wu = WorkUnit(
            client_id=catalog.id,
            code=code,
            name=name,
            business_object_type_id=types[obj].id,
            current_condition=pre,
            desired_condition=post,
            context="Order-to-cash, domestic and export, ERP as system of record",
            trigger=f"{obj} enters state {pre}",
            inputs=f"{obj} record in ERP; supporting documents",
            authority="CFO" if code == "WU-OTC-12" else owner,
            actor_constraints=owner,
            acceptance_criteria=f"{obj} state is {post} in the system of record",
            evidence_required=f"ERP event showing {obj} {pre}→{post}",
            verification_method=method,
            sla_hours=float(sla),
            failure_semantics="Hold the object; do not silently retry; notify owner",
            regulatory_entry_id=sox.id if code == "WU-OTC-12" else None,
            provenance=Provenance.designed,
            owner=owner,
            actor_type=actor,
            status=UnitStatus.reconciled,
        )
        db.add(wu)
        by_code[code] = wu
    db.flush()

    db.add(WorkUnitVariant(
        parent_id=by_code["WU-OTC-11"].id,
        name="Domestic",
        overrides='{"context":"Domestic receivable exception"}',
    ))
    db.add(WorkUnitVariant(
        parent_id=by_code["WU-OTC-11"].id,
        name="Cross-Border",
        overrides='{"context":"Cross-border receivable exception","authority":"Trade Compliance"}',
    ))

    for src, dst, etype in EDGES:
        db.add(WorkEdge(source_id=by_code[src].id, target_id=by_code[dst].id, edge_type=etype))

    # Sample VERDICT + cost on validate-order and write-off (gates differ)
    _score(db, by_code["WU-OTC-02"], dict(
        verifiability=5, evidence=5, reversibility=4, determinism=5,
        impact_scope=4, compliance=4, tacitness=5,
    ))
    _score(db, by_code["WU-OTC-12"], dict(
        verifiability=3, evidence=4, reversibility=1, determinism=2,
        impact_scope=1, compliance=1, tacitness=2,
    ))
    db.add(CostProfile(
        work_unit_id=by_code["WU-OTC-02"].id,
        executions_per_month=400,
        minutes_per_execution=6,
        verification_minutes=3,
        failure_rate=0.05,
        exception_minutes=20,
        maintenance_hours=2,
        attribution_confidence=0.8,
    ))
    db.commit()


def _score(db: Session, wu: WorkUnit, scores: dict) -> None:
    licensed = bool(wu.regulatory_entry_id)
    result = verdict_svc.derive_autonomy(
        scores,
        requires_licensed_human=licensed,
        evidence_path_exists=evidence_path_exists(wu),
    )
    row = VerdictScore(work_unit_id=wu.id, **scores)
    persist_derivation(row, result, wu.actor_type.value)
    wu.autonomy_level = 1  # authorised level starts at L1; recommendation is stored
    db.add(row)


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
        print("seed complete")
    finally:
        db.close()


if __name__ == "__main__":
    main()
