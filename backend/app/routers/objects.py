"""V10-11 (docs/contracts/v10-11-states.md): GET /api/objects/{name}/states
-- named before/after states for a business object, read straight off real
work_units.current_condition / desired_condition. No new graph table, no
ontology entity_types write; `name` is matched against the unit's own
business_object_type -> entity_types.name (case-insensitive contains),
never invented."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.ontology import EntityType
from ..models.workunit import WorkUnit
from ..schemas.objects import ObjectStateItem, ObjectStatesOut

router = APIRouter()

# Contractor is not this PR (docs/contracts/v10-11-states.md, section 1).
_ALLOWED_OBJECTS = ("offer", "employee")


@router.get("/{name}/states", response_model=ObjectStatesOut)
def object_states(name: str, db: TenantDbDep, key: OrgKeyDep) -> ObjectStatesOut:
    lname = name.lower()
    if lname not in _ALLOWED_OBJECTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown object '{name}'")

    rows = (
        db.query(WorkUnit.current_condition, WorkUnit.desired_condition)
        .join(EntityType, WorkUnit.business_object_type_id == EntityType.id)
        .filter(WorkUnit.client_id == key.client_id, EntityType.name.ilike(f"%{lname}%"))
        .all()
    )

    # lowercased name -> (display name, kind). Deduplicate by lowercased
    # name (contract section 1); keep the first-seen casing for display.
    seen: dict[str, tuple[str, str]] = {}
    for current, desired in rows:
        for raw, seen_as in ((current, "before"), (desired, "after")):
            trimmed = (raw or "").strip()
            if not trimmed:
                continue
            dedup_key = trimmed.lower()
            if dedup_key not in seen:
                seen[dedup_key] = (trimmed, seen_as)
            elif seen[dedup_key][1] != seen_as:
                seen[dedup_key] = (seen[dedup_key][0], "both")

    states = [
        ObjectStateItem(name=display, kind=kind)
        for display, kind in sorted(seen.values(), key=lambda t: t[0].lower())
    ]
    return ObjectStatesOut(object=lname, states=states, empty=len(states) == 0)
