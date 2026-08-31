"""C3: five outputs are projections of the same Work Unit records."""
from fastapi import APIRouter, Query

from ..dependencies import OptionalTenantDbDep
from ..models.economics import CostProfile
from ..models.graph import WorkEdge
from ..models.workunit import WorkUnit
from ..services import work_units as wu_svc
from ..services.economics import from_profile
from ..services.tenants import units_query
from ..services.verdict import LEVEL_NAMES, allocation_for

router = APIRouter()


def _units(db, client_id: int | None) -> list[WorkUnit]:
    return units_query(db, client_id).all()


@router.get("/inventory")
def inventory(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> dict:
    units = _units(db, client_id)
    return {"total": len(units), "items": [wu_svc.to_out(u).model_dump() for u in units]}


@router.get("/work-graph")
def work_graph(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> dict:
    units = _units(db, client_id)
    ids = {u.id for u in units}
    edges = [
        e for e in db.query(WorkEdge).order_by(WorkEdge.id).all()
        if e.source_id in ids and e.target_id in ids
    ]
    return {
        "nodes": [{"id": u.id, "code": u.code, "name": u.name} for u in units],
        "edges": [
            {"id": e.id, "source_id": e.source_id, "target_id": e.target_id, "edge_type": e.edge_type.value}
            for e in edges
        ],
    }


@router.get("/verification")
def verification(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> dict:
    units = _units(db, client_id)
    return {
        "items": [
            {
                "id": u.id,
                "code": u.code,
                "acceptance_criteria": u.acceptance_criteria,
                "evidence_required": u.evidence_required,
                "verification_method": u.verification_method.value,
                "autonomy_level": u.autonomy_level,
            }
            for u in units
        ]
    }


@router.get("/allocation")
def allocation(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> dict:
    units = _units(db, client_id)
    items = []
    for u in units:
        recommended = u.verdict.recommended_level if u.verdict else None
        origin = u.verdict.origin if u.verdict else None
        alloc = u.verdict.allocation if u.verdict else allocation_for(u.autonomy_level, u.actor_type.value)
        items.append({
            "id": u.id,
            "code": u.code,
            "owner": u.owner,
            "actor_type": u.actor_type.value,
            "autonomy_level": u.autonomy_level,
            "autonomy_name": LEVEL_NAMES.get(u.autonomy_level),
            "recommended_level": recommended,
            "allocation": alloc,
            "gates": u.verdict.applied_gates if u.verdict else "[]",
            "origin": origin,
        })
    return {"items": items}


@router.get("/economics")
def economics(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> dict:
    units = _units(db, client_id)
    ids = {u.id for u in units}
    profiles = [
        p for p in db.query(CostProfile).order_by(CostProfile.id).all()
        if p.work_unit_id in ids
    ]
    items = []
    totals = {"gross_hours": 0.0, "attributed_hours": 0.0, "fte": 0.0}
    inferred = 0
    for p in profiles:
        computed = from_profile(p)
        wu = p.work_unit
        items.append({
            "work_unit_id": p.work_unit_id,
            "code": wu.code if wu else "",
            "origin": p.origin,
            **computed,
        })
        totals["gross_hours"] += computed["gross_hours"]
        totals["attributed_hours"] += computed["attributed_hours"]
        totals["fte"] += computed["fte"]
        if (p.origin or "confirmed") == "inferred":
            inferred += 1
    return {
        "totals": {k: round(v, 4) for k, v in totals.items()},
        "inferred_profiles": inferred,
        "items": items,
    }


@router.get("/pack")
def pack(db: OptionalTenantDbDep, client_id: int | None = Query(default=None)) -> dict:
    alloc = allocation(db, client_id)
    l4 = sum(1 for row in alloc["items"] if (row.get("recommended_level") or 0) >= 4)
    econ = economics(db, client_id)
    inferred_verdict = sum(1 for row in alloc["items"] if row.get("origin") == "inferred")
    return {
        "inventory": inventory(db, client_id),
        "work_graph": work_graph(db, client_id),
        "verification": verification(db, client_id),
        "allocation": alloc,
        "economics": econ,
        "honest_case": {
            **econ["totals"],
            "verdict_l4_plus": l4,
            "verdict_inferred": inferred_verdict,
            "cost_inferred": econ.get("inferred_profiles", 0),
            "note": "Attributed hours are the smaller honest number (do + verify + exceptions, then attribution). Inferred VERDICT and minutes are drafts until confirmed.",
        },
    }
