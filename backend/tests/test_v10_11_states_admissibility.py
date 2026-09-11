"""V10-11 (docs/contracts/v10-11-states.md): named before/after states +
admissibility refusals for the Offer Desk -> Onboarding journey, plus the
handoff 422 extension. Real Postgres for the HTTP paths -- same reasoning
test_work_systems.py / test_field_ratifications.py give (TenantDbDep's
`SET app.current_client_id` is Postgres-only syntax SQLite can't execute).
The one Gate-9-stays-warn-on-import assertion uses the SQLite `db` fixture
+ a direct import_genome() call, same shape as test_gate9_terminal_state.py
-- genome import itself is untouched by this contract."""
from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

PG_URL = "postgresql+psycopg2://wep:wep@localhost:5433/wep"
try:
    _probe = create_engine(PG_URL, pool_pre_ping=True)
    with _probe.connect() as _c:
        _c.execute(text("SELECT 1"))
    POSTGRES_UP = True
except Exception:
    POSTGRES_UP = False

pg_skip = pytest.mark.skipif(not POSTGRES_UP, reason="Postgres not reachable at localhost:5433")
SetupSession = sessionmaker(bind=create_engine(PG_URL, pool_pre_ping=True)) if POSTGRES_UP else None


def _make_tenant(session, slug):
    raw_key = f"test-{slug}-key-" + "r" * 20
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    client_id = session.execute(text(
        "INSERT INTO clients (slug, name, industry, description, kind) VALUES (:s, :s, '', '', 'client') RETURNING id"
    ), {"s": f"test-{slug}"}).scalar()
    session.execute(text(
        "INSERT INTO org_api_keys (client_id, label, key_hash, is_active, created_at) VALUES (:cid, 'test', :h, true, now())"
    ), {"cid": client_id, "h": key_hash})
    return raw_key, client_id


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
    for table in ("verdict_scores", "cost_profiles", "verification_designs"):
        session.execute(text(
            f"DELETE FROM {table} WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
        ), ids)
    session.execute(text("DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) "
                          "OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_systems WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def tenant():
    session = SetupSession()
    key, cid = _make_tenant(session, "v1011")
    session.commit()
    session.close()
    yield {"headers": {"X-Spec-Key": key}, "client_id": cid}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


@pytest.fixture
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "v1011-a")
    key_b, cid_b = _make_tenant(session, "v1011-b")
    session.commit()
    session.close()
    yield {
        "headers_a": {"X-Spec-Key": key_a}, "client_a_id": cid_a,
        "headers_b": {"X-Spec-Key": key_b}, "client_b_id": cid_b,
    }
    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


def _type(real_client, name: str) -> int:
    r = real_client.post("/api/ontology/types", json={"name": name, "kind": "business_object"})
    if r.status_code == 409:
        existing = real_client.get("/api/ontology/types").json()["items"]
        return next(t["id"] for t in existing if t["name"] == name)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _wu(real_client, headers, type_id, code, **overrides) -> dict:
    body = {
        "code": code, "name": "Test unit", "business_object_type_id": type_id,
        "current_condition": "unchecked", "desired_condition": "accepted",
        "context": "", "trigger": "", "inputs": "",
        "authority": "", "actor_constraints": "", "acceptance_criteria": "",
        "evidence_required": "", "verification_method": "deterministic_rule",
        "sla_hours": 4, "failure_semantics": "", "owner": "Ops",
    }
    body.update(overrides)
    r = real_client.post("/api/work-units/", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _ensure_work_system(real_client, headers) -> dict:
    r = real_client.post("/api/work-systems", headers=headers, json={
        "code": "WS-OFFER-ONBOARD", "name": "Recruiter asks for offer -> Day-1 ready",
    })
    assert r.status_code == 201, r.text
    return r.json()


# --- Section 1: GET /api/objects/{name}/states ---

def test_states_rejects_missing_key(client):
    assert client.get("/api/objects/offer/states").status_code == 401


@pg_skip
def test_states_lists_before_after_from_real_units(real_client, tenant):
    headers = tenant["headers"]
    type_id = _type(real_client, f"Offer object {tenant['client_id']}")

    _wu(real_client, headers, type_id, "WU-ST-01",
        current_condition="unchecked", desired_condition="accepted")
    _wu(real_client, headers, type_id, "WU-ST-02",
        current_condition="accepted", desired_condition="released")

    resp = real_client.get("/api/objects/offer/states", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["object"] == "offer"
    assert body["empty"] is False
    by_name = {s["name"]: s["kind"] for s in body["states"]}
    assert by_name == {"unchecked": "before", "accepted": "both", "released": "after"}


@pg_skip
def test_states_case_insensitive_name_and_object_matching(real_client, tenant):
    headers = tenant["headers"]
    # "Employee-record" contains "employee" case-insensitively -- matched
    # without inventing a new entity_types row.
    type_id = _type(real_client, f"Employee-Record {tenant['client_id']}")
    _wu(real_client, headers, type_id, "WU-ST-EMP", current_condition="draft", desired_condition="active")

    resp = real_client.get("/api/objects/EMPLOYEE/states", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["object"] == "employee"
    by_name = {s["name"]: s["kind"] for s in body["states"]}
    assert by_name == {"draft": "before", "active": "after"}


@pg_skip
def test_states_empty_tenant_is_honest(real_client, tenant):
    resp = real_client.get("/api/objects/offer/states", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"object": "offer", "states": [], "empty": True}


@pg_skip
def test_states_unknown_object_name_404(real_client, tenant):
    resp = real_client.get("/api/objects/widget/states", headers=tenant["headers"])
    assert resp.status_code == 404, resp.text


# --- Section 2: admissibility ---

def test_admissibility_rejects_missing_key(client):
    assert client.get("/api/work-systems/1/admissibility").status_code == 401


@pg_skip
def test_admissibility_no_units_yet_is_not_a_fake_fail(real_client, tenant):
    ws = _ensure_work_system(real_client, tenant["headers"])
    resp = real_client.get(f"/api/work-systems/{ws['id']}/admissibility", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"work_system_id": ws["id"], "refusals": []}


@pg_skip
def test_no_exit_refused_without_a_sibling_and_admitted_with_one(real_client, tenant):
    """Contract test 1 + 2: a desired_condition with a sibling unit's
    matching current_condition is admissible; the same shape with no
    sibling is refused no_exit -- both on the one GET, not import."""
    headers = tenant["headers"]
    ws = _ensure_work_system(real_client, headers)
    type_id = _type(real_client, f"Offer BO {tenant['client_id']}")

    lonely = _wu(real_client, headers, type_id, "WU-OD-901",
                 current_condition="unchecked", desired_condition="accepted")

    lonely_check = real_client.get(f"/api/work-systems/{ws['id']}/admissibility", headers=headers)
    assert lonely_check.status_code == 200, lonely_check.text
    reasons = {r["work_unit_id"]: r["reason"] for r in lonely_check.json()["refusals"]}
    assert reasons.get(lonely["id"]) == "no_exit"

    handoff_lonely = real_client.get("/api/spec/handoff/WU-OD-901", headers=headers)
    assert handoff_lonely.status_code == 422, handoff_lonely.text
    assert handoff_lonely.json()["detail"]["reason"] == "no_exit"

    # Add the sibling: same business object, current_condition = the
    # lonely unit's desired_condition -- the exit now exists.
    _wu(real_client, headers, type_id, "WU-OD-902",
        current_condition="accepted", desired_condition="released")

    admitted_check = real_client.get(f"/api/work-systems/{ws['id']}/admissibility", headers=headers)
    assert admitted_check.status_code == 200, admitted_check.text
    reasons2 = {r["work_unit_id"]: r["reason"] for r in admitted_check.json()["refusals"]}
    assert lonely["id"] not in reasons2


@pg_skip
def test_two_owners_refused_one_owner_not(real_client, tenant):
    """Contract test 3, verbatim."""
    headers = tenant["headers"]
    ws = _ensure_work_system(real_client, headers)
    type_id = _type(real_client, f"Offer owners BO {tenant['client_id']}")

    two = _wu(real_client, headers, type_id, "WU-OD-910",
              current_condition="a", desired_condition="a", owner="Rashmi and Asha")
    one = _wu(real_client, headers, type_id, "WU-OD-911",
              current_condition="b", desired_condition="b", owner="Rashmi KN")

    resp = real_client.get(f"/api/work-systems/{ws['id']}/admissibility", headers=headers)
    reasons = {r["work_unit_id"]: r["reason"] for r in resp.json()["refusals"]}
    assert reasons.get(two["id"]) == "two_owners"
    assert one["id"] not in reasons


@pg_skip
def test_unaffordable_check_refused_without_hours_not_with(real_client, tenant):
    """Contract test 4, verbatim (sla_hours 0 is this schema's only
    reachable stand-in for "null" -- work_units.sla_hours is a
    non-nullable float column, see models/workunit.py)."""
    headers = tenant["headers"]
    ws = _ensure_work_system(real_client, headers)
    type_id = _type(real_client, f"Offer sla BO {tenant['client_id']}")

    unaffordable = _wu(real_client, headers, type_id, "WU-OD-920",
                        current_condition="a", desired_condition="a",
                        evidence_required="a signed form", sla_hours=0)
    affordable = _wu(real_client, headers, type_id, "WU-OD-921",
                      current_condition="b", desired_condition="b",
                      evidence_required="a signed form", sla_hours=2)

    resp = real_client.get(f"/api/work-systems/{ws['id']}/admissibility", headers=headers)
    reasons = {r["work_unit_id"]: r["reason"] for r in resp.json()["refusals"]}
    assert reasons.get(unaffordable["id"]) == "unaffordable_check"
    assert affordable["id"] not in reasons


@pg_skip
def test_rls_admissibility_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    ws_a = _ensure_work_system(real_client, headers_a)

    cross = real_client.get(f"/api/work-systems/{ws_a['id']}/admissibility", headers=headers_b)
    assert cross.status_code == 404, cross.text


@pg_skip
def test_dual_employment_stop_still_blocks_handoff_when_otherwise_admissible(real_client, tenant):
    """Contract test 7, verbatim: an admissible unit (self-satisfying exit,
    one owner, an affordable check) is still refused by the pre-existing,
    unliftable dual-employment stop -- V10-11 adds a new hard gate, it does
    not relax the old one."""
    headers = tenant["headers"]
    type_id = _type(real_client, f"Offer dual-employment BO {tenant['client_id']}")
    wu = _wu(
        real_client, headers, type_id, "WU-OD-02",
        current_condition="checked", desired_condition="checked",
        owner="Rashmi KN", evidence_required="", sla_hours=4,
        acceptance_criteria="All documents present",
    )
    scored = real_client.put(f"/api/verdict/{wu['id']}", headers=headers, json={
        "verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3,
        "impact_scope": 4, "compliance": 5, "tacitness": 3,
    })
    assert scored.status_code == 200, scored.text

    # Not inadmissible under V10-11 -- self-satisfying exit, one owner, no
    # evidence_required -- so this must be a 200 not-ready, not a 422.
    resp = real_client.get("/api/spec/handoff/WU-OD-02", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is False
    assert body["dual_employment_stop_required"] is True
    assert any("dual-employment stop" in r.lower() for r in body["reasons"])


@pg_skip
def test_units_off_the_journey_are_never_scored(real_client, tenant):
    """A code outside the Offer Desk / Onboarding prefixes (desk_of()) is
    simply not in scope -- an inadmissible-shaped unit off this journey
    must not show up in refusals or 422 a handoff."""
    headers = tenant["headers"]
    ws = _ensure_work_system(real_client, headers)
    type_id = _type(real_client, f"Finance BO {tenant['client_id']}")

    wu = _wu(real_client, headers, type_id, "WU-FIN-01",
             current_condition="a", desired_condition="lonely-and-unowned-and-unaffordable",
             owner="Rashmi and Asha", evidence_required="a form", sla_hours=0)

    resp = real_client.get(f"/api/work-systems/{ws['id']}/admissibility", headers=headers)
    reasons = {r["work_unit_id"]: r["reason"] for r in resp.json()["refusals"]}
    assert wu["id"] not in reasons

    handoff = real_client.get("/api/spec/handoff/WU-FIN-01", headers=headers)
    assert handoff.status_code == 200, handoff.text


def test_gate9_import_path_still_warns_not_rejects(db):
    """Contract test 2's second half: Gate 9 on genome import is unchanged
    by V10-11 -- a business object with no terminal state is still
    accepted with a warning, never rejected, and the admissibility gate
    never runs on the import path at all (that only lives at
    GET /work-systems/{id}/admissibility and GET /spec/handoff/{code})."""
    import hashlib as _hashlib

    from app.models.client import Client
    from app.models.discovery import ConformanceGap, GapKind
    from app.models.security import OrgApiKey
    from app.services.genome_import import import_genome

    def _wu_payload(code, business_object, current_condition, desired_condition):
        return {
            "id": code, "name": f"Do the thing {code}", "business_object": business_object,
            "current_condition": current_condition, "desired_condition": desired_condition,
            "context": {"decision_branches": "none", "variants": []},
            "trigger": "a request arrives", "input": ["a form"],
            "authority": "HR Ops", "actor_constraints": "HR Ops only",
            "acceptance_criteria": ["the thing is done"], "evidence_required": ["a record id"],
            "verification_method": "database_constraint",
            "sla_timing": {"time_per_case_min": 30}, "dependencies": ["external-input"],
            "failure_semantics": "hold and notify", "regulatory_register_link": ["RR-001"],
            "provenance": {"source_type": "observed", "hash_sha256": "a" * 64},
        }

    client = Client(slug="v1011-gate9", name="v1011-gate9", industry="", description="", kind="client")
    db.add(client)
    db.flush()
    db.add(OrgApiKey(
        client_id=client.id, label="t",
        key_hash=_hashlib.sha256(b"v1011-gate9").hexdigest(), is_active=True,
    ))
    db.commit()

    filler = [_wu_payload(f"WU-FILL{i}", f"Filler-{i}", "requested", "done") for i in range(4)]
    genome = {
        "work_units": filler + [
            _wu_payload("WU-C1", "Retention Case", "requested", "approved"),
            _wu_payload("WU-C2", "Retention Case", "approved", "issued"),
            _wu_payload("WU-C3", "Retention Case", "issued", "requested"),
        ],
        "dual_scoring_kappa": 0.85,
    }

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["missing_terminal_state_flagged"] == 1
    gap = db.query(ConformanceGap).filter(
        ConformanceGap.client_id == client.id, ConformanceGap.kind == GapKind.missing_terminal_state,
    ).one()
    assert gap.severity == "P2"
