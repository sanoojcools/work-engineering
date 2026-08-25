from fastapi import APIRouter

from ..dependencies import DbDep
from ..models.graph import WorkEdge
from ..models.workunit import WorkUnit
from ..schemas.client import CensusRunIn
from ..services import census as census_svc
from ..services import work_units as wu_svc
from ..services.economics import from_profile
from ..services.lookup import get_or_404
from ..services.tenants import units_for_function
from ..models.client import Client
from ..services.verdict import LEVEL_NAMES, allocation_for

router = APIRouter()


@router.post("/run")
def run_census(payload: CensusRunIn, db: DbDep) -> dict:
    get_or_404(db, Client, payload.client_id, "Client")
    return census_svc.run_census(
        db,
        payload.client_id,
        payload.function,
        payload.sop_text,
        payload.executions_per_month,
    )


@router.get("/pack/{client_id}")
def census_pack(client_id: int, db: DbDep, function: str = "HR & People Ops") -> dict:
    get_or_404(db, Client, client_id, "Client")
    units = units_for_function(
        db.query(WorkUnit).filter(WorkUnit.client_id == client_id).order_by(WorkUnit.id).all(),
        function,
    )
    ids = {u.id for u in units}
    edges = [
        e for e in db.query(WorkEdge).order_by(WorkEdge.id).all()
        if e.source_id in ids and e.target_id in ids
    ]
    alloc = []
    l4 = 0
    for u in units:
        recommended = u.verdict.recommended_level if u.verdict else None
        if (recommended or 0) >= 4:
            l4 += 1
        alloc.append({
            "id": u.id,
            "code": u.code,
            "owner": u.owner,
            "actor_type": u.actor_type.value,
            "autonomy_level": u.autonomy_level,
            "autonomy_name": LEVEL_NAMES.get(u.autonomy_level),
            "recommended_level": recommended,
            "allocation": u.verdict.allocation if u.verdict else allocation_for(u.autonomy_level, u.actor_type.value),
        })
    totals = {"gross_hours": 0.0, "attributed_hours": 0.0, "fte": 0.0}
    econ_items = []
    for u in units:
        if not u.cost_profile:
            continue
        computed = from_profile(u.cost_profile)
        econ_items.append({"work_unit_id": u.id, "code": u.code, **computed})
        totals["gross_hours"] += computed["gross_hours"]
        totals["attributed_hours"] += computed["attributed_hours"]
        totals["fte"] += computed["fte"]
    return {
        "client_id": client_id,
        "function": function,
        "inventory": {"total": len(units), "items": [wu_svc.to_out(u).model_dump() for u in units]},
        "work_graph": {
            "nodes": [{"id": u.id, "code": u.code, "name": u.name} for u in units],
            "edges": [
                {"id": e.id, "source_id": e.source_id, "target_id": e.target_id, "edge_type": e.edge_type.value}
                for e in edges
            ],
        },
        "verification": {
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
        },
        "allocation": {"items": alloc},
        "economics": {"totals": {k: round(v, 4) for k, v in totals.items()}, "items": econ_items},
        "honest_case": {
            **{k: round(v, 4) for k, v in totals.items()},
            "verdict_l4_plus": l4,
            "coverage": {
                "units": len(units),
                "verdict": sum(1 for u in units if u.verdict),
                "costed": sum(1 for u in units if u.cost_profile),
            },
            "note": "Attributed hours are the smaller honest number. VERDICT drafts are inferred until reviewed.",
        },
    }
