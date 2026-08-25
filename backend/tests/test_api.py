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


def test_suggest_persists_candidates_without_llm(client):
    response = client.post("/api/discovery/suggest", json={
        "text": "1. Collect joining documents\n2. Send welcome mail",
        "origin": "downward",
        "title": "HR JD",
        "kind": "job_description",
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["items"]) >= 2
    listed = client.get("/api/discovery/candidates")
    assert listed.json()["total"] >= 2
    intents = client.get("/api/discovery/intent")
    assert intents.json()["total"] >= 1
    assert "tacit" in body["items"][0]["sampling_bias_note"].lower()


def test_accept_and_reject_candidate(client):
    suggested = client.post("/api/discovery/suggest", json={
        "text": "Issue joining kit",
        "origin": "downward",
    }).json()["items"]
    cid = suggested[0]["id"]
    accepted = client.post(f"/api/discovery/candidates/{cid}/accept")
    assert accepted.status_code == 200, accepted.text
    unit = accepted.json()
    assert unit["status"] == "draft"
    assert unit["actor_type"] == "human"
    assert unit["provenance"] == "inferred"
    assert len(unit["current_condition"]) <= 80
    listed = client.get("/api/discovery/candidates")
    row = next(c for c in listed.json()["items"] if c["id"] == cid)
    assert row["status"] == "merged"
    assert row["work_unit_id"] == unit["id"]

    second = client.post("/api/discovery/suggest", json={"text": "Reject me", "origin": "downward"}).json()["items"][0]
    rejected = client.post(f"/api/discovery/candidates/{second['id']}/reject")
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"


def test_gap_scan_clears_and_classifies(client):
    client.post("/api/ontology/types", json={
        "name": "Employee",
        "kind": "business_object",
        "state_machine": '["draft","active"]',
    })
    client.post("/api/discovery/intent", json={
        "kind": "sop",
        "title": "Onboarding SOP",
        "body": "Welcome mail after offer signed",
    })
    scan = client.post("/api/discovery/gaps/scan")
    assert scan.status_code == 200, scan.text
    kinds = {g["kind"] for g in scan.json()["items"]}
    assert "unimplemented" in kinds
    again = client.post("/api/discovery/gaps/scan")
    assert again.json()["total"] == scan.json()["total"]


def test_census_pack(client):
    client.post("/api/seed")
    pack = client.get("/api/projections/pack")
    assert pack.status_code == 200, pack.text
    body = pack.json()
    for key in ("inventory", "work_graph", "verification", "allocation", "economics", "honest_case"):
        assert key in body


def test_company_boundary_and_hr_census(client):
    type_id = _type(client)
    _unit(client, type_id, code="WU-ONB-01", name="Collect joining documents")
    companies = client.get("/api/clients/")
    assert companies.status_code == 200, companies.text
    items = companies.json()["items"]
    catalog = next(c for c in items if c["slug"] == "catalog")
    demo = next(c for c in items if c["slug"] == "client-a")
    assert catalog["work_unit_count"] >= 1
    assert demo["work_unit_count"] >= 1
    demo_units = client.get(f"/api/work-units/?client_id={demo['id']}")
    assert demo_units.json()["total"] >= 1
    assert all(u["code"].startswith("WU-ONB") or u["code"].startswith("WU-OFF") for u in demo_units.json()["items"])
    run = client.post("/api/census/run", json={
        "client_id": demo["id"],
        "function": "HR & People Ops",
        "sop_text": "Welcome mail and day-1 setup",
    })
    assert run.status_code == 200, run.text
    body = run.json()
    assert body["verdict_drafted"] >= 1
    assert body["cost_attached"] >= 1
    pack = client.get(f"/api/census/pack/{demo['id']}?function=HR%20%26%20People%20Ops")
    assert pack.status_code == 200, pack.text
    assert pack.json()["inventory"]["total"] == body["units"]


def test_demo_prepare_and_confirmed_verdict_survives_rerun(client):
    prepared = client.post("/api/demo/prepare")
    assert prepared.status_code == 200, prepared.text
    body = prepared.json()
    demo_id = body["client_a_id"]
    assert body["census"]["units"] == 12
    units = client.get(f"/api/work-units/?client_id={demo_id}").json()["items"]
    assert len(units) == 12
    first = units[0]
    score = client.get(f"/api/verdict/{first['id']}")
    assert score.status_code == 200
    assert score.json()["origin"] == "inferred"
    payload = {k: score.json()[k] for k in (
        "verifiability", "evidence", "reversibility", "determinism",
        "impact_scope", "compliance", "tacitness",
    )}
    payload["verifiability"] = 5
    saved = client.put(f"/api/verdict/{first['id']}", json=payload)
    assert saved.status_code == 200
    assert saved.json()["origin"] == "confirmed"
    assert saved.json()["verifiability"] == 5
    again = client.post("/api/census/run", json={
        "client_id": demo_id,
        "function": "HR & People Ops",
        "sop_text": "Welcome only",
    })
    assert again.status_code == 200
    assert again.json()["verdict_confirmed_kept"] >= 1
    after = client.get(f"/api/verdict/{first['id']}").json()
    assert after["origin"] == "confirmed"
    assert after["verifiability"] == 5
    scoped = client.get(f"/api/projections/inventory?client_id={demo_id}")
    assert scoped.json()["total"] == 12
    pack = client.get(f"/api/projections/pack?client_id={demo_id}")
    assert pack.status_code == 200
    assert pack.json()["inventory"]["total"] == 12

