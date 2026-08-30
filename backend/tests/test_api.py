def test_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_spec_rejects_missing_key(client):
    response = client.get("/api/spec/checks")
    assert response.status_code == 401


def test_work_units_rejects_missing_key(client):
    response = client.post("/api/work-units/", json={"code": "WU-X", "name": "x"})
    assert response.status_code == 401


def test_census_rejects_missing_key(client):
    response = client.post("/api/census/run", json={
        "client_id": 1, "function": "HR & People Ops", "sop_text": "x",
    })
    assert response.status_code == 401


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


def test_client_list_and_demo_prepare_stay_open(client):
    """/clients and /demo/prepare are unauthenticated DbDep routes, untouched
    by Slice 3 PR 3a — the work-units/census flows they used to be tested
    alongside now require a per-org key and live in
    test_org_key_migration.py against real Postgres (RLS needs it)."""
    companies = client.get("/api/clients/")
    assert companies.status_code == 200, companies.text
    prepared = client.post("/api/demo/prepare")
    assert prepared.status_code == 200, prepared.text
    assert prepared.json()["census"]["units"] == 12

