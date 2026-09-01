"""Scout Elevated V2 PR1: interview sessions + Work Capture Grid + Genome
Strength completeness calc. Real Postgres only, same reason as every other
tenant-scoped test in this repo: tenant_db() runs `SET app.current_client_id`,
Postgres-specific syntax SQLite can't execute. _make_tenant / pg_skip /
cleanup follow test_rls_http.py (e67e499) exactly; scout tables are added
to the cleanup list before the clients DELETE.
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
    raw_key = f"test-{slug}-key-" + "s" * 20
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
    key_a, cid_a = _make_tenant(session, "scout-a")
    key_b, cid_b = _make_tenant(session, "scout-b")
    session.commit()
    session.close()

    yield {
        "key_a": key_a, "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a},
        "key_b": key_b, "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b},
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


@pg_skip
def test_create_session_and_isolated(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]

    created = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "sme", "interviewee_name": "Anjali R.",
    })
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "in_progress"
    assert body["completeness_pct"] == 0.0
    assert len(body["dimensions"]) == 8
    sid = body["id"]

    own = real_client.get(f"/api/scout/sessions/{sid}", headers=headers_a)
    assert own.status_code == 200, own.text

    cross = real_client.get(f"/api/scout/sessions/{sid}", headers=headers_b)
    assert cross.status_code == 404, cross.text

    listed_a = {s["id"] for s in real_client.get("/api/scout/sessions", headers=headers_a).json()["items"]}
    listed_b = {s["id"] for s in real_client.get("/api/scout/sessions", headers=headers_b).json()["items"]}
    assert sid in listed_a
    assert sid not in listed_b


@pg_skip
def test_scout_no_key_401(real_client):
    no_header = {}
    wrong = {"X-Spec-Key": "not-a-real-key"}
    for headers in (no_header, wrong):
        assert real_client.post("/api/scout/sessions", headers=headers, json={
            "type": "function_head", "interviewee_name": "x",
        }).status_code == 401
        assert real_client.get("/api/scout/sessions", headers=headers).status_code == 401


@pg_skip
def test_add_unit_updates_completeness(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    sid = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "sme", "interviewee_name": "Anjali R.",
    }).json()["id"]

    # A unit with every measured field filled should move every computed
    # dimension except work_units_captured (1 of 8 expected) to 100%.
    added = real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers_a, json={
        "name": "Payroll Run",
        "inputs": "attendance export", "outputs": "payslip batch",
        "systems": "HRIS, payroll engine", "frequency": "monthly", "time_minutes": 120,
        "pain": "manual reconciliation", "handoffs": "Finance -> HR",
        "decision_rule": "flag if attendance mismatch > 1 day",
    })
    assert added.status_code == 201, added.text
    body = added.json()
    assert len(body["units"]) == 1

    dims = {d["key"]: d for d in body["dimensions"]}
    assert dims["work_units_captured"]["captured"] == 1
    assert dims["work_units_captured"]["expected"] == 8
    assert dims["inputs_outputs"]["pct"] == 100.0
    assert dims["systems_tools"]["pct"] == 100.0
    assert dims["time_frequency"]["pct"] == 100.0
    assert dims["decisions_rules"]["pct"] == 100.0
    assert dims["handoffs"]["pct"] == 100.0
    assert dims["pain_exceptions"]["pct"] == 100.0
    assert dims["knowledge_artifacts"]["computed"] is False

    # completeness_pct averages only the 7 computed dimensions.
    assert body["completeness_pct"] == pytest.approx(
        (12.5 + 100 + 100 + 100 + 100 + 100 + 100) / 7, abs=0.1
    )


@pg_skip
def test_update_unit_inline_edit(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    sid = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "sme", "interviewee_name": "Tom K.",
    }).json()["id"]
    added = real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers_a, json={
        "name": "Onboarding", "inputs": "", "outputs": "",
    })
    unit_id = added.json()["units"][0]["id"]
    assert added.json()["dimensions"][1]["pct"] == 0.0  # inputs_outputs, nothing filled

    edited = real_client.patch(
        f"/api/scout/sessions/{sid}/units/{unit_id}", headers=headers_a,
        json={"inputs": "new-hire docs", "outputs": "onboarded employee"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["units"][0]["inputs"] == "new-hire docs"
    dims = {d["key"]: d for d in edited.json()["dimensions"]}
    assert dims["inputs_outputs"]["pct"] == 100.0


@pg_skip
def test_unit_cross_session_404(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    sid1 = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "sme", "interviewee_name": "A",
    }).json()["id"]
    sid2 = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "sme", "interviewee_name": "B",
    }).json()["id"]
    unit_id = real_client.post(f"/api/scout/sessions/{sid1}/units", headers=headers_a, json={
        "name": "X",
    }).json()["units"][0]["id"]

    wrong_session = real_client.patch(
        f"/api/scout/sessions/{sid2}/units/{unit_id}", headers=headers_a, json={"name": "Y"},
    )
    assert wrong_session.status_code == 404, wrong_session.text


@pg_skip
def test_complete_session(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    sid = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "function_head", "interviewee_name": "Function Head",
    }).json()["id"]
    completed = real_client.post(f"/api/scout/sessions/{sid}/complete", headers=headers_a)
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
