"""C3: five outputs are projections of the same Work Unit records."""
from fastapi import APIRouter

from ..dependencies import DbDep
from ..models.economics import CostProfile
from ..models.graph import WorkEdge
from ..models.verdict import VerdictScore
from ..models.workunit import WorkUnit
from ..services import work_units as wu_svc
from ..services.economics import from_profile
from ..services.verdict import LEVEL_NAMES, allocation_for

router = APIRouter()


@router.get("/inventory")
def inventory(db: DbDep) -> dict:
    units = db.query(WorkUnit).order_by(WorkUnit.id).all()
    return {"total": len(units), "items": [wu_svc.to_out(u).model_dump() for u in units]}


@router.get("/work-graph")
def work_graph(db: DbDep) -> dict:
    units = db.query(WorkUnit).order_by(WorkUnit.id).all()
    edges = db.query(WorkEdge).order_by(WorkEdge.id).all()
    return {
        "nodes": [{"id": u.id, "code": u.code, "name": u.name} for u in units],
        "edges": [
            {"id": e.id, "source_id": e.source_id, "target_id": e.target_id, "edge_type": e.edge_type.value}
            for e in edges
        ],
    }


@router.get("/verification")
def verification(db: DbDep) -> dict:
    units = db.query(WorkUnit).order_by(WorkUnit.id).all()
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
def allocation(db: DbDep) -> dict:
    units = db.query(WorkUnit).order_by(WorkUnit.id).all()
    items = []
    for u in units:
        recommended = u.verdict.recommended_level if u.verdict else None
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
        })
    return {"items": items}


@router.get("/economics")
def economics(db: DbDep) -> dict:
    profiles = db.query(CostProfile).order_by(CostProfile.id).all()
    items = []
    totals = {"gross_hours": 0.0, "attributed_hours": 0.0, "fte": 0.0}
    for p in profiles:
        computed = from_profile(p)
        wu = p.work_unit
        items.append({"work_unit_id": p.work_unit_id, "code": wu.code if wu else "", **computed})
        totals["gross_hours"] += computed["gross_hours"]
        totals["attributed_hours"] += computed["attributed_hours"]
        totals["fte"] += computed["fte"]
    return {"totals": {k: round(v, 4) for k, v in totals.items()}, "items": items}
