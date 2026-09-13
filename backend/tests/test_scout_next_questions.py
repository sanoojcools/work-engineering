"""SITTING-STEER backend: GET /api/scout/sessions/{id}/next-questions.

Real Postgres only for the positive paths -- TenantDbDep's
`SET app.current_client_id` is Postgres-specific syntax SQLite can't
execute (same reason test_field_ratifications.py / test_pointers.py are
real-Postgres-only); the SQLite `client` fixture is fine for the
missing-key 401 case since that never reaches tenant_db()."""
from __future__ import annotations

import hashlib
from pathlib import Path

import pytest
import yaml
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

YAML_PATH = Path(__file__).resolve().parents[2] / "packs" / "hr" / "question_bank.yaml"
YAML_RAW = YAML_PATH.read_text(encoding="utf-8")
PACK = yaml.safe_load(YAML_RAW)


def _pack_question(track: str, question_id: str) -> dict:
    return next(q for q in PACK["tracks"][track] if q["id"] == question_id)


def _make_tenant(session, slug):
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
    session.execute(text(
        "DELETE FROM scout_captured_units WHERE session_id IN "
        "(SELECT id FROM scout_interview_sessions WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM scout_interview_sessions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM field_ratifications WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM field_pointers WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM verification_designs WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM verdict_scores WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM work_unit_provenance WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("UPDATE work_units SET genome_version_id = NULL WHERE client_id = ANY(:ids)"), ids)
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
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "nq-a")
    key_b, cid_b = _make_tenant(session, "nq-b")
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
    r = real_client.post("/api/ontology/types", json={
        "name": "SITTING-STEER Test Object", "kind": "business_object", "state_machine": '["draft","done"]',
    })
    if r.status_code == 409:
        existing = real_client.get("/api/ontology/types").json()["items"]
        return next(t["id"] for t in existing if t["name"] == "SITTING-STEER Test Object")
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _work_unit(real_client, headers, type_id, code, **overrides) -> int:
    body = {
        "code": code, "name": "Offer Desk piece", "business_object_type_id": type_id,
        "current_condition": "draft", "desired_condition": "approved",
        "context": "", "trigger": "request arrives", "inputs": "form",
        "authority": "", "actor_constraints": "", "acceptance_criteria": "",
        "evidence_required": "", "verification_method": "deterministic_rule",
        "sla_hours": 4, "failure_semantics": "hold and notify", "owner": "Ops",
    }
    body.update(overrides)
    r = real_client.post("/api/work-units/", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _session(real_client, headers, seat: str) -> int:
    r = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": seat, "interviewee_name": "Test Interviewee",
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_next_questions_rejects_missing_key(client):
    assert client.get("/api/scout/sessions/1/next-questions").status_code == 401


@pg_skip
def test_no_key_401(real_client, two_tenants):
    for headers in ({}, {"X-Spec-Key": "not-a-real-key"}):
        r = real_client.get("/api/scout/sessions/1/next-questions", headers=headers)
        assert r.status_code == 401
        assert r.json() != []


@pg_skip
def test_empty_acceptance_on_sme_session_returns_s3_exact(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    session_id = _session(real_client, headers, "sme")
    _work_unit(
        real_client, headers, type_id, code="WU-OD-S3",
        desired_condition="approved and released", acceptance_criteria="",
    )

    r = real_client.get(f"/api/scout/sessions/{session_id}/next-questions", headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()

    s3 = _pack_question("sme", "s3")
    matches = [q for q in items if q["pack_id"] == "s3"]
    assert len(matches) == 1
    got = matches[0]
    assert got["text"] == s3["text"]
    assert got["why"] == s3["why"]
    assert got["field"] == "acceptance_criteria"
    assert got["seat"] == "sme"
    assert got["piece_code"] == "WU-OD-S3"
    # desired_condition was filled -- s1 must not also appear.
    assert not any(q["pack_id"] == "s1" for q in items)


@pg_skip
def test_empty_authority_on_function_head_returns_f3_not_s3(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    session_id = _session(real_client, headers, "function_head")
    _work_unit(
        real_client, headers, type_id, code="WU-OD-F3",
        authority="", acceptance_criteria="filled already", desired_condition="filled already",
    )

    r = real_client.get(f"/api/scout/sessions/{session_id}/next-questions", headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()

    f3 = _pack_question("function_head", "f3")
    assert len(items) == 1
    got = items[0]
    assert got["pack_id"] == "f3"
    assert got["text"] == f3["text"]
    assert got["field"] == "authority"
    assert got["seat"] == "function_head"
    assert got["piece_code"] == "WU-OD-F3"
    # Seat lock: an sme-track question id must never appear on a
    # function_head session, even though s3 also covers acceptance-shaped
    # ground -- the pack's sme track is simply never consulted here.
    assert not any(q["pack_id"] == "s3" for q in items)


@pg_skip
def test_all_three_binding_filled_returns_empty(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    session_id = _session(real_client, headers, "sme")
    _work_unit(
        real_client, headers, type_id, code="WU-OD-FULL",
        authority="Ops Lead", acceptance_criteria="Two approvals recorded",
        desired_condition="approved and released",
    )

    r = real_client.get(f"/api/scout/sessions/{session_id}/next-questions", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == []


@pg_skip
def test_question_text_is_literal_substring_of_yaml(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    session_id = _session(real_client, headers, "sub_function_lead")
    _work_unit(real_client, headers, type_id, code="WU-OD-L1", authority="")

    r = real_client.get(f"/api/scout/sessions/{session_id}/next-questions", headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1
    assert items[0]["pack_id"] == "l1"
    assert items[0]["text"] in YAML_RAW
    assert items[0]["why"] in YAML_RAW


@pg_skip
def test_second_tenant_cannot_see_first_tenants_session(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    type_id = _type(real_client)
    session_id = _session(real_client, headers_a, "sme")
    _work_unit(real_client, headers_a, type_id, code="WU-OD-RLS", acceptance_criteria="")

    cross = real_client.get(f"/api/scout/sessions/{session_id}/next-questions", headers=headers_b)
    assert cross.status_code == 404

    own = real_client.get(f"/api/scout/sessions/{session_id}/next-questions", headers=headers_a)
    assert own.status_code == 200
    assert len(own.json()) == 1


@pg_skip
def test_dual_employment_never_adds_an_invented_question(real_client, two_tenants):
    """WU-OD-02 is the real dual-employment code (services/handoff.py). Its
    failure_semantics carries no stop language here, deliberately -- this
    endpoint doesn't read failure_semantics/dual-employment at all, and must
    never surface a "dual employment" question, because there isn't one in
    the yaml (the pack's tracks only ever name f1-f3/l1-l5/s1-s5)."""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    session_id = _session(real_client, headers, "sme")
    _work_unit(
        real_client, headers, type_id, code="WU-OD-02",
        failure_semantics="", acceptance_criteria="", desired_condition="approved and released",
    )

    r = real_client.get(f"/api/scout/sessions/{session_id}/next-questions", headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) == 1
    assert items[0]["pack_id"] == "s3"
    all_ids = {q["id"] for track in PACK["tracks"].values() for q in track}
    assert all(item["pack_id"] in all_ids for item in items)
    assert not any("dual" in item["text"].lower() for item in items)
