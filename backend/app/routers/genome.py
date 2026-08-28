"""P0-5 + Day 5-6: Scout -> WEP genome handoff endpoints. Auth is per-org
(X-Spec-Key -> org_api_keys, see dependencies.require_org_api_key), NOT the
old global spec_api_key — this router is the first (only, so far) consumer
of TenantDbDep, deliberately kept separate from the legacy SpecKeyDep-based
routers until they're migrated one at a time (see dependencies.py docstring)."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, status

from pydantic import BaseModel

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.graph import EdgeType, WorkEdge
from ..models.ontology import EntityType
from ..models.security import (
    AuditLog,
    GenomeVersion,
    Ratification,
    WorkUnitProvenanceDetail,
    WorkUnitRegulatoryLink,
)
from ..models.verdict import VerdictScore
from ..models.workunit import WorkUnit
from ..services import work_units as wu_svc
from ..services.genome_import import import_genome
from ..services.lookup import get_or_404

router = APIRouter()


class RatifyIn(BaseModel):
    business_object: str | None = None
    work_unit_ids: list[str] | None = None
    approved: bool = True
    comment: str = ""


def _audit(db, client_id: int, actor: str, action: str, resource_id: str, detail: str = "") -> None:
    db.add(AuditLog(client_id=client_id, actor=actor, action=action, resource="genome_version",
                     resource_id=resource_id, detail=detail))


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
def ratify_genome(version_id: int, payload: RatifyIn, db: TenantDbDep, key: OrgKeyDep) -> dict:
    """Slice 2 PR 2b: whole-version (both fields null, unchanged behavior)
    or scoped to a business_object / work_unit_ids / their intersection.
    GenomeVersion.ratified only flips to true once every WU on the version
    has an approved=True Ratification row (or via the whole-version path)."""
    version = get_or_404(db, GenomeVersion, version_id, "GenomeVersion")
    if json.loads(version.gates_passed) != ["gqs", "pydantic_validation"]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Cannot ratify a genome that never passed the import gates")

    actor = key.label or f"org_api_key:{key.id}"

    if payload.business_object is None and payload.work_unit_ids is None:
        version.ratified = True
        version.ratified_by = actor
        _audit(db, key.client_id, actor, "genome.ratify.whole", str(version.id), payload.comment)
        db.commit()
        return {"version_id": version.id, "ratified": version.ratified, "ratified_by": version.ratified_by}

    query = db.query(WorkUnit).filter(WorkUnit.genome_version_id == version_id)
    if payload.business_object is not None:
        query = query.join(EntityType, WorkUnit.business_object_type_id == EntityType.id).filter(
            EntityType.name == payload.business_object)
    if payload.work_unit_ids is not None:
        query = query.filter(WorkUnit.code.in_(payload.work_unit_ids))
    targets = query.all()

    if not targets:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No Work Units match that ratification scope")

    for wu in targets:
        existing = db.query(Ratification).filter(
            Ratification.version_id == version_id, Ratification.work_unit_id == wu.id
        ).one_or_none()
        if existing:
            existing.approved = payload.approved
            existing.comment = payload.comment
            existing.ratified_by = actor
        else:
            db.add(Ratification(
                client_id=key.client_id, version_id=version_id, work_unit_id=wu.id,
                business_object=wu.business_object_type.name, approved=payload.approved,
                comment=payload.comment, ratified_by=actor,
            ))

    action = "genome.ratify.business_object" if payload.business_object is not None else "genome.ratify.work_units"
    _audit(db, key.client_id, actor, action, str(version.id),
           json.dumps({"business_object": payload.business_object, "work_unit_ids": payload.work_unit_ids,
                       "approved": payload.approved, "count": len(targets)}))
    db.commit()

    total_wus = db.query(WorkUnit).filter(WorkUnit.genome_version_id == version_id).count()
    approved_wu_ids = {
        r.work_unit_id for r in db.query(Ratification).filter(
            Ratification.version_id == version_id, Ratification.approved.is_(True)
        ).all()
    }
    fully_ratified = len(approved_wu_ids) == total_wus
    if fully_ratified and not version.ratified:
        version.ratified = True
        version.ratified_by = actor
        db.commit()

    return {
        "version_id": version.id,
        "ratified": version.ratified,
        "scope": "business_object" if payload.business_object else "work_unit_ids",
        "work_units_affected": [wu.code for wu in targets],
        "fully_ratified": fully_ratified,
    }


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

    # genome.read audited here only (L3, single-record drill-down) — L1/L2
    # list endpoints are not, on volume grounds (playbook F.2: "only if the
    # volume is acceptable... document the choice").
    _audit(db, key.client_id, key.label or f"org_api_key:{key.id}", "genome.read.work_unit", wu_code)
    db.commit()

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
