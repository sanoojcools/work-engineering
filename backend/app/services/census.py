"""One-click function census inside one company. Deterministic drafts, inferred cost."""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from ..models.discovery import ConformanceGap, GapKind, IntentKind, IntentSource
from ..models.economics import CostProfile
from ..models.graph import EdgeType, WorkEdge
from ..models.ontology import Provenance
from ..models.workunit import WorkUnit
from ..services.economics import from_profile
from ..services.tenants import units_for_function
from ..services.work_units import apply_verdict


def draft_verdict_scores(wu: WorkUnit) -> dict[str, int]:
    evidence = (wu.evidence_required or "").lower()
    acceptance = (wu.acceptance_criteria or "").lower()
    current = (wu.current_condition or "").strip()
    desired = (wu.desired_condition or "").strip()
    method = wu.verification_method.value if wu.verification_method else ""

    hard_evidence = any(k in evidence for k in ("id", "log", "erp", "system", "screenshot", "mail", "ticket"))
    numbered = bool(re.search(r"\d", acceptance)) or " and " in acceptance
    auto_method = method in {
        "deterministic_rule", "database_constraint", "cross_system_reconciliation",
    }

    v = 5 if auto_method or numbered else 3
    e = 5 if hard_evidence and evidence not in {"", "tbd"} else (2 if not evidence or evidence == "tbd" else 3)
    d = 5 if current and desired and current.lower() != "tbd" and desired.lower() != "tbd" else 3
    r = 4
    i = 3
    c = 2 if wu.regulatory_entry_id else 4
    t = 5 if wu.actor_type.value == "deterministic" else (4 if wu.actor_type.value == "agent" else 3)
    return {
        "verifiability": v,
        "evidence": e,
        "reversibility": r,
        "determinism": d,
        "impact_scope": i,
        "compliance": c,
        "tacitness": t,
    }


def infer_minutes(wu: WorkUnit) -> float:
    blob = f"{wu.code} {wu.name}".lower()
    if any(k in blob for k in ("reconcil", "compliance", "grievance", "settlement", "write off", "credit")):
        return 30
    if any(k in blob for k in ("triage", "ticket", "password", "chat", "bug", "mail", "welcome")):
        return 15
    return 15


def apply_inferred_cost(db: Session, wu: WorkUnit, executions_per_month: float) -> CostProfile | None:
    row = db.query(CostProfile).filter(CostProfile.work_unit_id == wu.id).one_or_none()
    if row is not None and (row.origin or "confirmed") == "confirmed" and row.minutes_per_execution:
        return row
    minutes = infer_minutes(wu)
    if row is None:
        row = CostProfile(work_unit_id=wu.id)
        db.add(row)
    if not row.minutes_per_execution:
        row.minutes_per_execution = minutes
    if not row.verification_minutes:
        row.verification_minutes = max(2.0, minutes * 0.3)
    if not row.executions_per_month:
        row.executions_per_month = executions_per_month
    if (row.attribution_confidence or 1) >= 0.99:
        row.attribution_confidence = 0.6
    row.origin = "inferred"
    return row


def ensure_function_edges(db: Session, units: list[WorkUnit]) -> int:
    by_code = {u.code: u for u in units}
    existing = {
        (e.source_id, e.target_id, e.edge_type)
        for e in db.query(WorkEdge).filter(
            WorkEdge.source_id.in_([u.id for u in units] or [0])
        ).all()
    }
    added = 0

    def add(src: WorkUnit, dst: WorkUnit, etype: EdgeType) -> None:
        nonlocal added
        key = (src.id, dst.id, etype)
        if key in existing or src.id == dst.id:
            return
        db.add(WorkEdge(source_id=src.id, target_id=dst.id, edge_type=etype))
        existing.add(key)
        added += 1

    for prefix in ("WU-ONB", "WU-OFF"):
        ordered = sorted((u for u in units if u.code.startswith(prefix)), key=lambda u: u.code)
        for a, b in zip(ordered, ordered[1:]):
            add(a, b, EdgeType.sequence)

    by_obj: dict[int, list[WorkUnit]] = {}
    for u in units:
        by_obj.setdefault(u.business_object_type_id, []).append(u)
    for group in by_obj.values():
        if len(group) < 2:
            continue
        head = sorted(group, key=lambda u: u.code)[0]
        for other in group[1:]:
            add(head, other, EdgeType.shared_object)
    return added


def gaps_from_sop(db: Session, units: list[WorkUnit], sop_text: str, client_id: int) -> list[ConformanceGap]:
    ids = [u.id for u in units] or [0]
    db.query(ConformanceGap).filter(ConformanceGap.work_unit_id.in_(ids)).delete()
    created: list[ConformanceGap] = []
    if sop_text.strip():
        hay = re.sub(r"\s+", " ", sop_text.lower())
        for wu in units:
            needle = re.sub(r"\s+", " ", wu.name.lower())
            if needle and needle not in hay and wu.code.lower() not in hay:
                created.append(ConformanceGap(
                    kind=GapKind.unimplemented,
                    description=f"SOP does not mention {wu.code} ({wu.name}).",
                    declared_ref="pasted SOP",
                    discovered_ref=wu.code,
                    work_unit_id=wu.id,
                    client_id=client_id,
                ))
        intent = IntentSource(
            kind=IntentKind.sop,
            title="Census SOP",
            body=sop_text,
            provenance=Provenance.declared,
            client_id=client_id,
        )
        db.add(intent)
    for wu in units:
        acc = (wu.acceptance_criteria or "").strip()
        ev = (wu.evidence_required or "").strip()
        if not acc or acc.upper() == "TBD" or not ev or ev.upper() == "TBD":
            created.append(ConformanceGap(
                kind=GapKind.missing_acceptance,
                description=f"{wu.code} is missing acceptance criteria or evidence.",
                declared_ref=wu.code,
                work_unit_id=wu.id,
                client_id=client_id,
            ))
    db.add_all(created)
    return created


def run_census(
    db: Session,
    client_id: int,
    function: str,
    sop_text: str = "",
    executions_per_month: float = 50,
) -> dict:
    all_units = db.query(WorkUnit).filter(WorkUnit.client_id == client_id).order_by(WorkUnit.id).all()
    units = units_for_function(all_units, function)
    scored = 0
    costed = 0
    skipped = 0
    for wu in units:
        if wu.verdict and (wu.verdict.origin or "confirmed") == "confirmed":
            skipped += 1
        else:
            apply_verdict(db, wu, draft_verdict_scores(wu), origin="inferred")
            scored += 1
        apply_inferred_cost(db, wu, executions_per_month)
        costed += 1
    edges = ensure_function_edges(db, units)
    gap_rows = gaps_from_sop(db, units, sop_text, client_id)
    db.commit()

    totals = {"gross_hours": 0.0, "attributed_hours": 0.0, "fte": 0.0}
    l4 = 0
    for wu in units:
        db.refresh(wu)
        if wu.verdict and wu.verdict.recommended_level >= 4:
            l4 += 1
        if wu.cost_profile:
            computed = from_profile(wu.cost_profile)
            totals["gross_hours"] += computed["gross_hours"]
            totals["attributed_hours"] += computed["attributed_hours"]
            totals["fte"] += computed["fte"]
    return {
        "client_id": client_id,
        "function": function,
        "units": len(units),
        "verdict_drafted": scored,
        "verdict_confirmed_kept": skipped,
        "cost_attached": costed,
        "gaps": len(gap_rows),
        "edges_added": edges,
        "l4_plus": l4,
        "economics": {k: round(v, 4) for k, v in totals.items()},
        "note": "VERDICT and minutes are inferred from the contract. Review before treating as authoritative.",
    }
