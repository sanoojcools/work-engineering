"""P0-5 + Day 5-6: Scout -> WEP genome handoff endpoints. Auth is per-org
(X-Spec-Key -> org_api_keys, see dependencies.require_org_api_key), NOT the
old global spec_api_key — this router is the first (only, so far) consumer
of TenantDbDep, deliberately kept separate from the legacy SpecKeyDep-based
routers until they're migrated one at a time (see dependencies.py docstring)."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.security import GenomeVersion
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
