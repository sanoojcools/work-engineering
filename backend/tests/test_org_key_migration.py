"""Slice 3 PR 3a (playbook G.1): work_units, spec, and census moved off the
old no-auth DbDep / legacy global spec_api_key onto per-org X-Spec-Key
(OrgKeyDep/TenantDbDep), same as genome import. These flows go through
`SET app.current_client_id` (see dependencies.tenant_db), which SQLite
can't run, so — like the existing genome/RLS tests — this runs against
real Postgres only.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
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


def _fixed_genome():
    with open(SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-FIXED.json", encoding="utf-8") as f:
        genome = json.load(f)
    genome["dual_scoring_kappa"] = 0.85
    return genome


def _make_tenant(session, slug):
    raw_key = f"test-{slug}-key-" + "m" * 20
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


_WORK_UNIT_CHILD_TABLES = (
    "work_unit_provenance", "work_unit_regulatory_links", "pii_field_values",
    "verdict_scores", "cost_profiles", "verification_runs", "autonomy_changes",
    "spec_checks", "trajectories", "ratifications",
)


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
    for table in _WORK_UNIT_CHILD_TABLES:
        session.execute(text(
            f"DELETE FROM {table} WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
        ), ids)
    session.execute(text(
        "DELETE FROM work_unit_variants WHERE parent_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def one_tenant():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "wu-a")
    session.commit()
    session.close()

    yield {"key": key_a, "client_id": cid_a}

    session = SetupSession()
    _cleanup(session, [cid_a])
    session.close()


@pytest.fixture
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "iso-a")
    key_b, cid_b = _make_tenant(session, "iso-b")
    session.commit()
    session.close()

    yield {"key_a": key_a, "client_a_id": cid_a, "key_b": key_b, "client_b_id": cid_b}

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


def _type(real_client) -> int:
    """entity_types is global, not per-tenant, and this Postgres database
    persists across tests in this module — reuse the type if a previous
    test in this run already created it instead of erroring on the name
    uniqueness constraint."""
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
        "verification_method": "deterministic_rule",
        "sla_hours": 4,
        "failure_semantics": "hold and notify",
        "owner": "Order Desk",
    }
    body.update(overrides)
    return body


@pg_skip
def test_work_unit_crud_and_verdict_gates_with_org_key(real_client, one_tenant):
    headers = {"X-Spec-Key": one_tenant["key"]}
    type_id = _type(real_client)
    created_resp = real_client.post("/api/work-units/", headers=headers, json=_unit_body(type_id))
    assert created_resp.status_code == 201, created_resp.text
    created = created_resp.json()
    assert created["machine_readable"] is True
    uid = created["id"]

    high = {
        "verifiability": 5, "evidence": 5, "reversibility": 5,
        "determinism": 5, "impact_scope": 5, "compliance": 5, "tacitness": 5,
    }
    scored = real_client.put(f"/api/verdict/{uid}", json=high)
    assert scored.status_code == 200, scored.text
    assert scored.json()["recommended_level"] == 6

    gated = real_client.put(f"/api/verdict/{uid}", json={**high, "compliance": 1})
    assert gated.json()["recommended_level"] == 2
    assert "gate1_regulatory" in gated.json()["applied_gates"]

    listed = real_client.get("/api/work-units/", headers=headers)
    assert listed.status_code == 200, listed.text
    assert any(u["id"] == uid for u in listed.json()["items"])


@pg_skip
def test_promote_requires_runs_with_org_key(real_client, one_tenant):
    headers = {"X-Spec-Key": one_tenant["key"]}
    type_id = _type(real_client)
    uid = real_client.post("/api/work-units/", headers=headers, json=_unit_body(type_id)).json()["id"]
    real_client.put(f"/api/verdict/{uid}", json={
        "verifiability": 5, "evidence": 5, "reversibility": 5,
        "determinism": 5, "impact_scope": 5, "compliance": 5, "tacitness": 5,
    })
    response = real_client.post(f"/api/work-units/{uid}/promote", headers=headers, json={
        "to_level": 2, "approved_by": "Asha", "reason": "trial",
    })
    assert response.status_code == 422


@pg_skip
def test_spec_enforcement_with_org_key(real_client, one_tenant):
    headers = {"X-Spec-Key": one_tenant["key"]}
    type_id = _type(real_client)
    real_client.post("/api/work-units/", headers=headers, json=_unit_body(type_id))

    denied = real_client.post("/api/spec/check", headers=headers, json={
        "work_unit_code": "WU-TEST-01",
        "check_type": "authority",
        "caller": "agent-runtime",
        "approver": "",
    })
    assert denied.status_code == 200, denied.text
    assert denied.json()["result"] == "denied"

    allowed = real_client.post("/api/spec/check", headers=headers, json={
        "work_unit_code": "WU-TEST-01",
        "check_type": "authority",
        "caller": "agent-runtime",
        "approver": "Order Desk",
    })
    assert allowed.json()["result"] == "allowed"


@pg_skip
def test_wrong_key_401_on_migrated_routers(real_client, one_tenant):
    wrong = {"X-Spec-Key": "not-a-real-key"}
    assert real_client.get("/api/work-units/", headers=wrong).status_code == 401
    assert real_client.get("/api/spec/checks", headers=wrong).status_code == 401
    assert real_client.post("/api/census/run", headers=wrong, json={
        "client_id": one_tenant["client_id"], "function": "HR & People Ops", "sop_text": "x",
    }).status_code == 401


@pg_skip
def test_cross_tenant_404_on_work_units_spec_census(real_client, two_tenants):
    headers_a = {"X-Spec-Key": two_tenants["key_a"]}
    headers_b = {"X-Spec-Key": two_tenants["key_b"]}
    type_id = _type(real_client)
    uid = real_client.post("/api/work-units/", headers=headers_a, json=_unit_body(type_id)).json()["id"]

    assert real_client.get(f"/api/work-units/{uid}", headers=headers_b).status_code == 404
    assert real_client.get("/api/spec/work-units/WU-TEST-01", headers=headers_b).status_code == 404

    # census/run: B naming A's client_id is rejected as a 404, not a raw RLS error
    cross = real_client.post("/api/census/run", headers=headers_b, json={
        "client_id": two_tenants["client_a_id"], "function": "HR & People Ops", "sop_text": "x",
    })
    assert cross.status_code == 404, cross.text


@pg_skip
def test_rotate_then_old_key_401_after_grace_new_key_200_gqs_untouched(real_client, one_tenant):
    from app import dependencies as deps

    headers = {"X-Spec-Key": one_tenant["key"]}
    rotated = real_client.post("/api/org/keys/rotate", headers=headers)
    assert rotated.status_code == 200, rotated.text
    body = rotated.json()
    new_key = body["key"]
    assert new_key != one_tenant["key"]

    # Old key still works inside the grace window.
    still_ok = real_client.get("/api/work-units/", headers=headers)
    assert still_ok.status_code == 200, still_ok.text

    # New key works immediately.
    new_ok = real_client.get("/api/work-units/", headers={"X-Spec-Key": new_key})
    assert new_ok.status_code == 200, new_ok.text

    # Force the old key past its grace window and confirm it now 401s.
    session = SetupSession()
    session.execute(
        text("UPDATE org_api_keys SET expires_at = :past WHERE client_id = :cid AND is_active = false"),
        {"past": datetime.now(timezone.utc) - timedelta(minutes=1), "cid": one_tenant["client_id"]},
    )
    session.commit()
    session.close()

    expired = real_client.get("/api/work-units/", headers=headers)
    assert expired.status_code == 401, expired.text

    # Genome import + GQS path is untouched by any of the above.
    genome = _fixed_genome()
    imported = real_client.post("/api/genome/import", headers={"X-Spec-Key": new_key}, json=genome)
    assert imported.status_code == 201, imported.text
    version_id = imported.json()["version_id"]
    gqs = real_client.get(f"/api/genome/{version_id}/gqs", headers={"X-Spec-Key": new_key})
    assert gqs.status_code == 200, gqs.text
    assert gqs.json()["gqs"] == pytest.approx(94.29, abs=0.01)

    assert deps.ROTATION_GRACE_MINUTES > 0


def test_no_hardcoded_spec_key_default_in_source():
    app_root = Path(__file__).resolve().parents[1] / "app"
    hits = [
        str(p) for p in app_root.rglob("*.py")
        if "__pycache__" not in p.parts and "dev-spec-key-change-me" in p.read_text(encoding="utf-8", errors="ignore")
    ]
    assert not hits, f"Legacy global spec key default still present in: {hits}"


def test_settings_has_no_spec_api_key_field():
    from app.config import Settings

    assert not hasattr(Settings(), "spec_api_key")
