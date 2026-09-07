"""P2 -- Handoff completeness (docs/BUILD_PROGRAM.md CENSUS-PACK). Real
Postgres only for the positive paths -- same reasoning test_moderation.py's
own docstring gives (TenantDbDep's `SET app.current_client_id` is
Postgres-only syntax SQLite can't execute).
"""
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
    session.execute(text("DELETE FROM verdict_scores WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


def _make_work_unit(real_client, headers, cid, code, suffix, **overrides):
    # entity_types.name is globally unique, not per-tenant -- suffix keeps
    # a fresh name every test run against a warm, already-exercised database.
    et = real_client.post("/api/ontology/types", json={
        "name": f"test-handoff-object-{cid}-{suffix}", "kind": "business_object",
    })
    assert et.status_code == 201, et.text
    body = {
        "code": code,
        "name": "Test handoff unit",
        "business_object_type_id": et.json()["id"],
        "current_condition": "unchecked",
        "desired_condition": "checked",
    }
    body.update(overrides)
    wu = real_client.post("/api/work-units/", headers=headers, json=body)
    assert wu.status_code == 201, wu.text
    return wu.json()


@pytest.fixture
def tenant(real_client):
    session = SetupSession()
    key, cid = _make_tenant(session, "handoff")
    session.commit()
    session.close()
    yield {"headers": {"X-Spec-Key": key}, "client_id": cid}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


def test_handoff_rejects_missing_key(client):
    assert client.get("/api/spec/handoff/WU-ANY").status_code == 401


@pg_skip
def test_not_ready_when_no_record_exists(real_client, tenant):
    resp = real_client.get("/api/spec/handoff/WU-DOES-NOT-EXIST", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is False
    assert body["bundle"] is None
    assert "no record" in body["reasons"][0].lower()


@pg_skip
def test_not_ready_when_record_exists_but_never_scored(real_client, tenant):
    _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-A", "a")
    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-A", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is False
    assert body["gates"] is None
    assert body["bundle"] is None
    assert any("verdict" in r.lower() for r in body["reasons"])


@pg_skip
def test_ready_once_scored_with_no_dual_employment_requirement(real_client, tenant):
    wu = _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-B", "b")
    scored = real_client.put(
        f"/api/verdict/{wu['id']}",
        headers=tenant["headers"],
        json={"verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3, "impact_scope": 4, "compliance": 5, "tacitness": 3},
    )
    assert scored.status_code == 200, scored.text

    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-B", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is True, body["reasons"]
    assert body["reasons"] == []
    assert isinstance(body["gates"], list)
    assert body["dual_employment_stop_required"] is False
    assert body["bundle"] is not None
    assert body["bundle"]["code"] == "WU-TEST-HANDOFF-B"


@pg_skip
def test_dual_employment_unit_not_ready_without_the_stop_stated(real_client, tenant):
    # WU-OD-02 is the one code this rule actually checks -- created here
    # WITHOUT the sheet's own dual-employment language, so a real (scored)
    # record can still be honestly refused.
    wu = _make_work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "c",
        acceptance_criteria="All documents present", evidence_required="Zwayam event",
    )
    scored = real_client.put(
        f"/api/verdict/{wu['id']}",
        headers=tenant["headers"],
        json={"verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3, "impact_scope": 4, "compliance": 5, "tacitness": 3},
    )
    assert scored.status_code == 200, scored.text

    resp = real_client.get("/api/spec/handoff/WU-OD-02", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["dual_employment_stop_required"] is True
    assert body["ready"] is False
    assert body["bundle"] is None
    assert any("dual-employment stop" in r.lower() for r in body["reasons"])


@pg_skip
def test_dual_employment_unit_ready_once_the_stop_is_stated_and_scored(real_client, tenant):
    wu = _make_work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "d",
        failure_semantics="If dual employment detected in UAN: do NOT release offer -- deviation approval required.",
    )
    scored = real_client.put(
        f"/api/verdict/{wu['id']}",
        headers=tenant["headers"],
        json={"verifiability": 3, "evidence": 4, "reversibility": 3, "determinism": 2, "impact_scope": 4, "compliance": 5, "tacitness": 3},
    )
    assert scored.status_code == 200, scored.text

    resp = real_client.get("/api/spec/handoff/WU-OD-02", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["dual_employment_stop_required"] is True
    assert body["ready"] is True, body["reasons"]
    assert body["bundle"] is not None


@pg_skip
def test_rls_handoff_isolation_via_http(real_client, tenant):
    session = SetupSession()
    key_b, cid_b = _make_tenant(session, "handoff-b")
    session.commit()
    session.close()
    headers_b = {"X-Spec-Key": key_b}

    _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-RLS", "rls")

    # Tenant B cannot see tenant A's record -- reads as "no record", not a
    # cross-tenant leak of A's readiness.
    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-RLS", headers=headers_b)
    assert resp.status_code == 200, resp.text
    assert resp.json()["ready"] is False
    assert "no record" in resp.json()["reasons"][0].lower()

    session = SetupSession()
    _cleanup(session, [cid_b])
    session.close()
