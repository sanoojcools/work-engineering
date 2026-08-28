"""P0-5 + Day 5-6: Scout -> WEP genome handoff endpoints. Auth is per-org
(X-Spec-Key -> org_api_keys, see dependencies.require_org_api_key), NOT the
old global spec_api_key — this router is the first (only, so far) consumer
of TenantDbDep, deliberately kept separate from the legacy SpecKeyDep-based
routers until they're migrated one at a time (see dependencies.py docstring)."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.graph import EdgeType, WorkEdge
from ..models.ontology import EntityType
from ..models.security import GenomeVersion, WorkUnitProvenanceDetail, WorkUnitRegulatoryLink
from ..models.verdict import VerdictScore
from ..models.workunit import WorkUnit
from ..services import work_units as wu_svc
from ..services.genome_import import import_genome
from ..services.lookup import get_or_404

router = APIRouter()


@router.post("/import", status_code=status.HTTP_201_CREATED)
def import_genome_endpoint(payload: dict, db: TenantDbDep, key: OrgKeyDep) -> dict:
    result = import_genome(db, key.client_id, payload, actor=key.label or f"org_api_key:{key.id}")
    if not result["accepted"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.get("/{version_id}/gqs")
def get_gqs(version_id: int, db: TenantDbDep, key: OrgKeyDep) -> dict:
    version = get_or_404(db, GenomeVersion, version_id, "GenomeVersion")
    return {
        "version_id": version.id,
        "gqs": version.gqs_score,
        "gates_passed": json.loads(version.gates_passed),
        "gates_failed": json.loads(version.gates_failed),
        "work_unit_count": version.work_unit_count,
        "ratified": version.ratified,
    }


@router.get("/{version_id}")
def get_genome(version_id: int, db: TenantDbDep, key: OrgKeyDep) -> dict:
    version = get_or_404(db, GenomeVersion, version_id, "GenomeVersion")
    wus = db.query(WorkUnit).filter(WorkUnit.genome_version_id == version_id).order_by(WorkUnit.id).all()
    return {
        "version_id": version.id,
        "gqs": version.gqs_score,
        "ratified": version.ratified,
        "work_unit_count": len(wus),
        "work_units": [wu_svc.to_out(w).model_dump() for w in wus],
    }


@router.post("/{version_id}/ratify")
def ratify_genome(version_id: int, db: TenantDbDep, key: OrgKeyDep, ratified_by: str = "") -> dict:
    version = get_or_404(db, GenomeVersion, version_id, "GenomeVersion")
    if not version.ratified and json.loads(version.gates_passed) != ["gqs", "pydantic_validation"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Cannot ratify a genome that never passed the import gates")
    version.ratified = True
    version.ratified_by = ratified_by or (key.label or f"org_api_key:{key.id}")
    db.commit()
    return {"version_id": version.id, "ratified": version.ratified, "ratified_by": version.ratified_by}


@router.get("/{version_id}/business-objects")
def list_business_objects(version_id: int, db: TenantDbDep, key: OrgKeyDep) -> dict:
    """Slice 2 PR 2a, L1: progressive disclosure entry point — the wedge
    pitch ("ratify objects, not 1,116 fields") starts here. `ratified` is
    whole-version only for now (BO-level partial ratification is PR 2b, not
    built yet) — every BO on a ratified version shows true, none show
    "partial" until 2b lands; that's an honest simplification, not a lie."""
    version = get_or_404(db, GenomeVersion, version_id, "GenomeVersion")
    wus = db.query(WorkUnit).filter(WorkUnit.genome_version_id == version_id).all()

    by_bo: dict[str, list[WorkUnit]] = {}
    for wu in wus:
        by_bo.setdefault(wu.business_object_type.name, []).append(wu)

    business_objects = []
    for name, group in sorted(by_bo.items()):
        entity_type = group[0].business_object_type
        state_machine = json.loads(entity_type.state_machine) if entity_type.state_machine else []
        business_objects.append({
            "name": name,
            "work_unit_count": len(group),
            "ratified": bool(version.ratified),
            "state_machine": state_machine,
            "needs_state_machine": not state_machine,
        })

    return {"version_id": version.id, "business_objects": business_objects}


@router.get("/{version_id}/business-objects/{bo_name}/work-units")
def list_work_units_for_business_object(version_id: int, bo_name: str, db: TenantDbDep, key: OrgKeyDep) -> dict:
    """L2: one Business Object's Work Units, not the full 18-attr drill-down (that's L3)."""
    get_or_404(db, GenomeVersion, version_id, "GenomeVersion")
    wus = (
        db.query(WorkUnit)
        .join(EntityType, WorkUnit.business_object_type_id == EntityType.id)
        .filter(WorkUnit.genome_version_id == version_id, EntityType.name == bo_name)
        .order_by(WorkUnit.id)
        .all()
    )
    items = []
    for wu in wus:
        verdict = db.query(VerdictScore).filter(VerdictScore.work_unit_id == wu.id).one_or_none()
        prov = db.query(WorkUnitProvenanceDetail).filter(WorkUnitProvenanceDetail.work_unit_id == wu.id).one_or_none()
        items.append({
            "id": wu.code,
            "name": wu.name,
            "current_condition": wu.current_condition,
            "desired_condition": wu.desired_condition,
            "time_per_case_min": round(wu.sla_hours * 60, 2) if wu.sla_hours else None,
            "autonomy": verdict.recommended_level if verdict else None,
            "provenance": {
                "file_id": prov.file_id if prov else None,
                "row": prov.row_ref if prov else None,
                "hash_sha256": prov.hash_sha256 if prov else None,
            },
        })
    return {"version_id": version_id, "business_object": bo_name, "work_units": items}


@router.get("/{version_id}/work-units/{wu_code}")
def get_work_unit_full(version_id: int, wu_code: str, db: TenantDbDep, key: OrgKeyDep) -> dict:
    """L3: full 18-attr drill-down. Arrays are reconstructed from the
    joined-string DB columns genome_import.py writes them as — the wire
    contract keeps arrays as arrays even though storage doesn't."""
    get_or_404(db, GenomeVersion, version_id, "GenomeVersion")
    wu = (
        db.query(WorkUnit)
        .filter(WorkUnit.genome_version_id == version_id, WorkUnit.code == wu_code)
        .one_or_none()
    )
    if wu is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"WorkUnit {wu_code} not found on version {version_id}")

    try:
        context = json.loads(wu.context) if wu.context else {"decision_branches": "", "variants": []}
    except (json.JSONDecodeError, TypeError):
        context = {"decision_branches": wu.context or "", "variants": []}
    context.setdefault("variants", [])

    prov = db.query(WorkUnitProvenanceDetail).filter(WorkUnitProvenanceDetail.work_unit_id == wu.id).one_or_none()
    rr_links = (
        db.query(WorkUnitRegulatoryLink)
        .filter(WorkUnitRegulatoryLink.work_unit_id == wu.id)
        .all()
    )
    dependencies = (
        db.query(WorkUnit.code)
        .join(WorkEdge, WorkEdge.source_id == WorkUnit.id)
        .filter(WorkEdge.target_id == wu.id, WorkEdge.edge_type == EdgeType.sequence)
        .all()
    )

    return {
        "id": wu.code,
        "name": wu.name,
        "business_object": wu.business_object_type.name,
        "current_condition": wu.current_condition,
        "desired_condition": wu.desired_condition,
        "context": context,
        "trigger": wu.trigger,
        "input": [s for s in wu.inputs.split("; ") if s] if wu.inputs else [],
        "authority": wu.authority,
        "actor_constraints": wu.actor_constraints,
        "acceptance_criteria": [s for s in wu.acceptance_criteria.split("; ") if s] if wu.acceptance_criteria else [],
        "evidence_required": [s for s in wu.evidence_required.split("; ") if s] if wu.evidence_required else [],
        "verification_method": wu.verification_method.value,
        "sla_hours": wu.sla_hours,
        "dependencies": [d[0] for d in dependencies],
        "failure_semantics": wu.failure_semantics,
        "regulatory_register_link": [link.regulatory_entry.regulation for link in rr_links],
        "provenance": {
            "source_type": prov.source_type.value if prov else wu.provenance.value,
            "file_id": prov.file_id if prov else None,
            "row": prov.row_ref if prov else None,
            "hash_sha256": prov.hash_sha256 if prov else None,
            "interview_ref": prov.interview_ref if prov else "",
        },
    }
