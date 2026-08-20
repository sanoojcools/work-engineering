from app.config import settings
from app.models.ontology import EntityKind
from app.models.workunit import VerificationMethod
from app.models.execution import CheckType


def _type(client) -> int:
    response = client.post("/api/ontology/types", json={
        "name": "Order",
        "kind": EntityKind.business_object.value,
        "state_machine": '["draft","validated"]',
    })
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _unit(client, type_id: int, **overrides) -> dict:
    body = {
        "code": "WU-TEST-01",
        "name": "Validate order",
        "business_object_type_id": type_id,
        "current_condition": "draft",
        "desired_condition": "validated",
        "context": "O2C",
        "trigger": "order submitted",
        "inputs": "order record",
        "authority": "Order Desk",
        "actor_constraints": "Order Desk",
        "acceptance_criteria": "Order state is validated",
        "evidence_required": "ERP status change",
        "verification_method": VerificationMethod.deterministic_rule.value,
        "sla_hours": 4,
        "failure_semantics": "hold and notify",
        "owner": "Order Desk",
    }
    body.update(overrides)
    response = client.post("/api/work-units/", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_spec_rejects_missing_key(client):
    response = client.get("/api/spec/checks")
    assert response.status_code == 401


def test_work_unit_crud_and_verdict_gates(client):
    type_id = _type(client)
    created = _unit(client, type_id)
    assert created["machine_readable"] is True
    uid = created["id"]

    high = {
        "verifiability": 5, "evidence": 5, "reversibility": 5,
        "determinism": 5, "impact_scope": 5, "compliance": 5, "tacitness": 5,
    }
    scored = client.put(f"/api/verdict/{uid}", json=high)
    assert scored.status_code == 200, scored.text
    assert scored.json()["recommended_level"] == 6

    gated = client.put(f"/api/verdict/{uid}", json={**high, "compliance": 1})
    assert gated.json()["recommended_level"] == 2
    assert "gate1_regulatory" in gated.json()["applied_gates"]


def test_promote_requires_runs(client):
    type_id = _type(client)
    uid = _unit(client, type_id)["id"]
    client.put(f"/api/verdict/{uid}", json={
        "verifiability": 5, "evidence": 5, "reversibility": 5,
        "determinism": 5, "impact_scope": 5, "compliance": 5, "tacitness": 5,
    })
    response = client.post(f"/api/work-units/{uid}/promote", json={
        "to_level": 2, "approved_by": "Asha", "reason": "trial",
    })
    assert response.status_code == 422


def test_spec_enforcement_denies_without_authority(client):
    type_id = _type(client)
    _unit(client, type_id)
    headers = {"X-Spec-Key": settings.spec_api_key}
    denied = client.post("/api/spec/check", headers=headers, json={
        "work_unit_code": "WU-TEST-01",
        "check_type": CheckType.authority.value,
        "caller": "agent-runtime",
        "approver": "",
    })
    assert denied.status_code == 200
    assert denied.json()["result"] == "denied"

    allowed = client.post("/api/spec/check", headers=headers, json={
        "work_unit_code": "WU-TEST-01",
        "check_type": CheckType.authority.value,
        "caller": "agent-runtime",
        "approver": "Order Desk",
    })
    assert allowed.json()["result"] == "allowed"


def test_seed_otc_census(client):
    response = client.post("/api/seed")
    assert response.status_code == 200, response.text
    assert response.json()["work_units"] == 16
    inventory = client.get("/api/projections/inventory")
    assert inventory.json()["total"] == 16
    graph = client.get("/api/work-graph/edges")
    assert graph.json()["total"] >= 1
