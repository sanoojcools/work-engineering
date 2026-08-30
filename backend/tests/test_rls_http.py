"""Slice 3 PR 3b (playbook G.2): the Gate 15 regression, automated. Replaces
the manual two-tenant RLS verification script with a real HTTP matrix
proving Org A cannot see Org B's data — across every router Slice 3 PR 3a
moved onto per-org X-Spec-Key (work_units, spec, census) plus genome, which
was already on it. Real Postgres only, same reason as
test_org_key_migration.py: `tenant_db()` runs `SET app.current_client_id`,
Postgres-specific syntax SQLite can't execute.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

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
SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"

_WORK_UNIT_CHILD_TABLES = (
    "work_unit_provenance", "work_unit_regulatory_links", "pii_field_values",
    "verdict_scores", "cost_profiles", "verification_runs", "autonomy_changes",
    "spec_checks", "trajectories", "ratifications",
)


def _fixed_genome():
    with open(SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-FIXED.json", encoding="utf-8") as f:
        genome = json.load(f)
    genome["dual_scoring_kappa"] = 0.85
    return genome


def _make_tenant(session, slug):
    """No key-issuance endpoint exists yet (see dependencies.py, genome
    router docstring) — every tenant fixture in this repo, genome's
    included, mints its org_api_keys row with a direct insert. Same
    sha256(raw_key) scheme require_org_api_key checks against."""
    raw_key = f"test-{slug}-key-" + "r" * 20
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    client_id = session.execute(text(
        "INSERT INTO clients (slug, name, industry, description, kind) "
        "VALUES (:s, :s, '', '', 'client') RETURNING id"
    ), {"s": f"test-{slug}"}).scalar()
    session.execute(text(
        "INSERT INTO org_api_keys (client_id, label, key_hash, is_active, created_at) "
        "VALUES (:cid, 'test', :h, true, now())"
    ), {"cid": client_id, "h": key_hash})
    return raw_key, client_id


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
    for table in _WORK_UNIT_CHILD_TABLES:
        session.execute(text(
            f"DELETE FROM {table} WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
        ), ids)
    session.execute(text(
        "DELETE FROM work_unit_variants WHERE parent_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) "
        "OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    # census/run (services/census.gaps_from_sop) writes conformance_gaps
    # (FK'd to work_unit_id) and discovery/suggest can write
    # discovery_candidates the same way — both block the work_units delete
    # below if left in place.
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM discovery_candidates WHERE client_id = ANY(:ids)"), ids)
    # GenomeVersion rows land even on a rejected import (GQS runs before the
    # gate check) — delete these before work_units, or the FK from
    # work_units.genome_version_id blocks the work_units delete below.
    session.execute(text("UPDATE work_units SET genome_version_id = NULL WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM intent_sources WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM review_queue WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM uploaded_files WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "rls-a")
    key_b, cid_b = _make_tenant(session, "rls-b")
    session.commit()
    session.close()

    yield {
        "key_a": key_a, "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a},
        "key_b": key_b, "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b},
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


def _type(real_client) -> int:
    """entity_types is global, not per-tenant, and this Postgres database
    persists across tests in this run — reuse the type a previous test
    already created instead of erroring on the name-uniqueness constraint."""
    r = real_client.post("/api/ontology/types", json={
        "name": "Order",
        "kind": "business_object",
        "state_machine": '["draft","validated"]',
    })
    if r.status_code == 409:
        existing = real_client.get("/api/ontology/types").json()["items"]
        return next(t["id"] for t in existing if t["name"] == "Order")
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _unit_body(type_id: int, **overrides) -> dict:
    body = {
        "code": "WU-RLS-01",
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
        "verification_method": "deterministic_rule",
        "sla_hours": 4,
        "failure_semantics": "hold and notify",
        "owner": "Order Desk",
    }
    body.update(overrides)
    return body


@pg_skip
def test_rls_work_units_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    type_id = _type(real_client)
    uid = real_client.post("/api/work-units/", headers=headers_a, json=_unit_body(type_id)).json()["id"]

    # A can read its own unit.
    own = real_client.get(f"/api/work-units/{uid}", headers=headers_a)
    assert own.status_code == 200, own.text

    # B gets 404 on the same id, not a redacted 200 or a 403 that would
    # confirm the id exists.
    cross = real_client.get(f"/api/work-units/{uid}", headers=headers_b)
    assert cross.status_code == 404, cross.text

    # B's list never contains A's unit.
    listed_b = real_client.get("/api/work-units/", headers=headers_b).json()["items"]
    assert all(u["id"] != uid for u in listed_b)


@pg_skip
def test_rls_spec_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    type_id = _type(real_client)
    real_client.post("/api/work-units/", headers=headers_a, json=_unit_body(type_id, code="WU-RLS-SPEC-01"))

    own = real_client.get("/api/spec/work-units/WU-RLS-SPEC-01", headers=headers_a)
    assert own.status_code == 200, own.text

    cross = real_client.get("/api/spec/work-units/WU-RLS-SPEC-01", headers=headers_b)
    assert cross.status_code == 404, cross.text

    # A `spec/check` against A's own unit works; the same code is invisible to B.
    checked = real_client.post("/api/spec/check", headers=headers_a, json={
        "work_unit_code": "WU-RLS-SPEC-01", "check_type": "authority",
        "caller": "agent-runtime", "approver": "Order Desk",
    })
    assert checked.status_code == 200, checked.text
    assert checked.json()["result"] == "allowed"

    denied = real_client.post("/api/spec/check", headers=headers_b, json={
        "work_unit_code": "WU-RLS-SPEC-01", "check_type": "authority",
        "caller": "agent-runtime", "approver": "Order Desk",
    })
    assert denied.status_code == 404, denied.text


@pg_skip
def test_rls_census_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    cid_a = two_tenants["client_a_id"]
    cid_b = two_tenants["client_b_id"]

    # census only scores units matching the requested function's code
    # prefixes (services.tenants.FUNCTION_PREFIXES) — WU-ONB/WU-OFF/WU-HR
    # for "HR & People Ops".
    type_id = _type(real_client)
    real_client.post("/api/work-units/", headers=headers_a, json=_unit_body(type_id, code="WU-ONB-01", name="Collect joining documents"))

    run = real_client.post("/api/census/run", headers=headers_a, json={
        "client_id": cid_a, "function": "HR & People Ops", "sop_text": "Welcome mail and day-1 setup",
    })
    assert run.status_code == 200, run.text

    own_pack = real_client.get(f"/api/census/pack/{cid_a}", headers=headers_a)
    assert own_pack.status_code == 200, own_pack.text
    assert own_pack.json()["inventory"]["total"] >= 1

    # B naming A's client_id — on either endpoint — is a 404, not a peek.
    cross_pack = real_client.get(f"/api/census/pack/{cid_a}", headers=headers_b)
    assert cross_pack.status_code == 404, cross_pack.text

    cross_run = real_client.post("/api/census/run", headers=headers_b, json={
        "client_id": cid_a, "function": "HR & People Ops", "sop_text": "x",
    })
    assert cross_run.status_code == 404, cross_run.text

    # B's own pack is empty — A's census run left nothing visible to B.
    b_pack = real_client.get(f"/api/census/pack/{cid_b}", headers=headers_b)
    assert b_pack.status_code == 200, b_pack.text
    assert b_pack.json()["inventory"]["total"] == 0


@pg_skip
def test_rls_genome_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    genome = _fixed_genome()

    imported = real_client.post("/api/genome/import", headers=headers_a, json=genome)
    assert imported.status_code == 201, imported.text
    version_id = imported.json()["version_id"]

    own = real_client.get(f"/api/genome/{version_id}", headers=headers_a)
    assert own.status_code == 200, own.text
    assert own.json()["work_unit_count"] == 14

    assert real_client.get(f"/api/genome/{version_id}", headers=headers_b).status_code == 404
    assert real_client.get(f"/api/genome/{version_id}/business-objects", headers=headers_b).status_code == 404
    assert real_client.post(f"/api/genome/{version_id}/ratify", headers=headers_b, json={}).status_code == 404


@pg_skip
def test_rls_list_never_crosses_tenant(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    type_id = _type(real_client)
    uid_a = real_client.post("/api/work-units/", headers=headers_a, json=_unit_body(type_id, code="WU-RLS-LIST-A")).json()["id"]
    uid_b = real_client.post("/api/work-units/", headers=headers_b, json=_unit_body(type_id, code="WU-RLS-LIST-B")).json()["id"]

    items_a = {u["id"] for u in real_client.get("/api/work-units/", headers=headers_a).json()["items"]}
    items_b = {u["id"] for u in real_client.get("/api/work-units/", headers=headers_b).json()["items"]}

    assert uid_a in items_a and uid_a not in items_b
    assert uid_b in items_b and uid_b not in items_a
    assert items_a.isdisjoint(items_b)


@pg_skip
def test_rls_no_key_401(real_client, two_tenants):
    cid_a = two_tenants["client_a_id"]
    no_header = {}
    wrong = {"X-Spec-Key": "not-a-real-key"}

    for headers in (no_header, wrong):
        assert real_client.get("/api/work-units/", headers=headers).status_code == 401
        assert real_client.get("/api/spec/checks", headers=headers).status_code == 401
        assert real_client.post("/api/census/run", headers=headers, json={
            "client_id": cid_a, "function": "HR & People Ops", "sop_text": "x",
        }).status_code == 401
        assert real_client.post("/api/genome/import", headers=headers, json={}).status_code == 401
        assert real_client.post("/api/org/keys/rotate", headers=headers).status_code == 401
