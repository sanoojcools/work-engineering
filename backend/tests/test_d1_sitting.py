"""D-1: CHRO sitting tests (sitting-answers, draft-strategy-intent, hard-anchors).
Tests against real Postgres -- no mocks, no new table unless HONESTY says why."""
from __future__ import annotations

import hashlib
import json

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
    session.execute(text("DELETE FROM work_systems WHERE client_id = ANY(:ids)"), ids)
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
    key_a, cid_a = _make_tenant(session, "d1-a")
    key_b, cid_b = _make_tenant(session, "d1-b")
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
def test_put_get_sitting_answers_roundtrip(real_client, two_tenants):
    """PUT answers on function_head persists; GET round-trips."""
    headers_a = two_tenants["headers_a"]

    # Create function_head session
    resp = real_client.post("/api/scout/sessions", json={
        "type": "function_head",
        "interviewee_name": "Test CHRO",
    }, headers=headers_a)
    assert resp.status_code == 201
    session_id = resp.json()["id"]

    # PUT sitting answers
    answers_in = {
        "answers": [
            {"id": "pain", "text": "Last hire that broke: UAN verification took 2 weeks"},
            {"id": "so_what", "text": "Rashmi owns document verification"},
            {"id": "this_period", "text": "Cut offer-to-Day-1 cycle time"},
            {"id": "in_out", "text": "In: automate document checks. Out: invented KPIs"},
            {"id": "who_binds", "text": "Rashmi binds for Offer Desk"},
            {"id": "anchor:dual_employment", "text": "Confirmed"}
        ]
    }
    resp = real_client.put(f"/api/scout/sessions/{session_id}/sitting-answers", json=answers_in, headers=headers_a)
    assert resp.status_code == 200

    # GET sitting answers
    resp = real_client.get(f"/api/scout/sessions/{session_id}/sitting-answers", headers=headers_a)
    assert resp.status_code == 200
    answers_out = resp.json()
    assert len(answers_out["answers"]) == 6
    assert answers_out["answers"][0]["id"] == "pain"
    assert answers_out["answers"][0]["text"] == "Last hire that broke: UAN verification took 2 weeks"

    # Verify stored in timeline_json
    session = SetupSession()
    stored_data = session.execute(text(
        "SELECT timeline_json FROM scout_interview_sessions WHERE id = :sid"
    ), {"sid": session_id}).scalar()
    session.close()
    stored = json.loads(stored_data)
    assert "sitting_answers" in stored
    assert len(stored["sitting_answers"]) == 6


@pg_skip
def test_put_sitting_answers_empty_text_allowed(real_client, two_tenants):
    """Empty text is allowed (they skipped)."""
    headers_a = two_tenants["headers_a"]

    resp = real_client.post("/api/scout/sessions", json={
        "type": "function_head",
        "interviewee_name": "Test CHRO",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    answers_in = {
        "answers": [
            {"id": "pain", "text": ""},
            {"id": "so_what", "text": "Skipped this question"}
        ]
    }
    resp = real_client.put(f"/api/scout/sessions/{session_id}/sitting-answers", json=answers_in, headers=headers_a)
    assert resp.status_code == 200

    resp = real_client.get(f"/api/scout/sessions/{session_id}/sitting-answers", headers=headers_a)
    assert resp.status_code == 200
    answers_out = resp.json()
    assert answers_out["answers"][0]["text"] == ""


@pg_skip
def test_put_sitting_answers_on_sme_session_422(real_client, two_tenants):
    """PUT on sme session → 422."""
    headers_a = two_tenants["headers_a"]

    resp = real_client.post("/api/scout/sessions", json={
        "type": "sme",
        "interviewee_name": "Test SME",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    answers_in = {"answers": [{"id": "pain", "text": "Should fail"}]}
    resp = real_client.put(f"/api/scout/sessions/{session_id}/sitting-answers", json=answers_in, headers=headers_a)
    assert resp.status_code == 422


@pg_skip
def test_get_sitting_answers_on_sme_session_404(real_client, two_tenants):
    """GET on sme session → 404."""
    headers_a = two_tenants["headers_a"]

    resp = real_client.post("/api/scout/sessions", json={
        "type": "sme",
        "interviewee_name": "Test SME",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    resp = real_client.get(f"/api/scout/sessions/{session_id}/sitting-answers", headers=headers_a)
    assert resp.status_code == 404


@pg_skip
def test_cross_tenant_sitting_answers_404(real_client, two_tenants):
    """Cross-tenant GET/PUT 404."""
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]

    # Create session with headers_a
    resp = real_client.post("/api/scout/sessions", json={
        "type": "function_head",
        "interviewee_name": "Test CHRO",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    # Try to GET with headers_b
    resp = real_client.get(f"/api/scout/sessions/{session_id}/sitting-answers", headers=headers_b)
    assert resp.status_code == 404

    # Try to PUT with headers_b
    answers_in = {"answers": [{"id": "pain", "text": "Should fail"}]}
    resp = real_client.put(f"/api/scout/sessions/{session_id}/sitting-answers", json=answers_in, headers=headers_b)
    assert resp.status_code == 404


@pg_skip
def test_draft_strategy_intent_happy_path(real_client, two_tenants):
    """draft-strategy happy path: focus substring stored; confirmed_at still null."""
    headers_a = two_tenants["headers_a"]

    # Create function_head session with sitting answers
    resp = real_client.post("/api/scout/sessions", json={
        "type": "function_head",
        "interviewee_name": "Test CHRO",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    answers_in = {
        "answers": [
            {"id": "this_period", "text": "This quarter: cut offer-to-Day-1 cycle time, not headcount"}
        ]
    }
    real_client.put(f"/api/scout/sessions/{session_id}/sitting-answers", json=answers_in, headers=headers_a)

    # Create work system
    resp = real_client.post("/api/work-systems", json={
        "code": "offer-day1",
        "name": "Offer to Day-1",
        "entry": "Recruiter request received",
        "exit": "Day-1 ready",
        "owner": "HR Ops",
        "outcome": "Hire is complete",
        "strategy_intent_focus": "Existing seed",
        "strategy_intent_owner": "CHRO"
    }, headers=headers_a)
    work_system_id = resp.json()["id"]

    # Draft strategy intent
    resp = real_client.post(f"/api/work-systems/{work_system_id}/draft-strategy-intent", json={
        "focus": "cut offer-to-Day-1 cycle time",
        "source_session_id": session_id
    }, headers=headers_a)
    assert resp.status_code == 200
    result = resp.json()
    assert result["strategy_intent"]["label"] == "cut offer-to-Day-1 cycle time"
    assert result["strategy_intent"]["confirmed_at"] is None
    assert result["strategy_intent"]["confirmed_by"] == ""

    # Verify in DB
    session = SetupSession()
    ws_focus = session.execute(text(
        "SELECT strategy_intent_focus, strategy_intent_confirmed_at FROM work_systems WHERE id = :wid"
    ), {"wid": work_system_id}).fetchone()
    session.close()
    assert ws_focus[0] == "cut offer-to-Day-1 cycle time"
    assert ws_focus[1] is None


@pg_skip
def test_draft_strategy_intent_422_if_focus_not_in_answers(real_client, two_tenants):
    """draft-strategy 422 if focus not in answers."""
    headers_a = two_tenants["headers_a"]

    # Create function_head session with sitting answers
    resp = real_client.post("/api/scout/sessions", json={
        "type": "function_head",
        "interviewee_name": "Test CHRO",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    answers_in = {
        "answers": [
            {"id": "this_period", "text": "Cut cycle time"}
        ]
    }
    real_client.put(f"/api/scout/sessions/{session_id}/sitting-answers", json=answers_in, headers=headers_a)

    # Create work system
    resp = real_client.post("/api/work-systems", json={
        "code": "offer-day1-2",
        "name": "Offer to Day-1",
        "entry": "Recruiter request received",
        "exit": "Day-1 ready",
        "owner": "HR Ops",
        "outcome": "Hire is complete"
    }, headers=headers_a)
    work_system_id = resp.json()["id"]

    # Draft with focus that is NOT a substring
    resp = real_client.post(f"/api/work-systems/{work_system_id}/draft-strategy-intent", json={
        "focus": "increase headcount",  # NOT in the answer
        "source_session_id": session_id
    }, headers=headers_a)
    assert resp.status_code == 422


@pg_skip
def test_draft_strategy_intent_422_if_already_confirmed(real_client, two_tenants):
    """draft-strategy 422 if already confirmed."""
    headers_a = two_tenants["headers_a"]

    # Create function_head session with sitting answers
    resp = real_client.post("/api/scout/sessions", json={
        "type": "function_head",
        "interviewee_name": "Test CHRO",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    answers_in = {
        "answers": [
            {"id": "this_period", "text": "Cut cycle time"}
        ]
    }
    real_client.put(f"/api/scout/sessions/{session_id}/sitting-answers", json=answers_in, headers=headers_a)

    # Create work system and confirm it
    resp = real_client.post("/api/work-systems", json={
        "code": "offer-day1-3",
        "name": "Offer to Day-1",
        "entry": "Recruiter request received",
        "exit": "Day-1 ready",
        "owner": "HR Ops",
        "outcome": "Hire is complete",
        "strategy_intent_focus": "Cut cycle time",
        "strategy_intent_owner": "CHRO"
    }, headers=headers_a)
    work_system_id = resp.json()["id"]

    # Confirm strategy intent
    real_client.post(f"/api/work-systems/{work_system_id}/confirm-strategy-intent", json={
        "confirmed_by": "Test CHRO"
    }, headers=headers_a)

    # Try to draft again
    resp = real_client.post(f"/api/work-systems/{work_system_id}/draft-strategy-intent", json={
        "focus": "Cut cycle time",
        "source_session_id": session_id
    }, headers=headers_a)
    assert resp.status_code == 422


@pg_skip
def test_draft_strategy_intent_422_if_session_not_function_head(real_client, two_tenants):
    """draft-strategy 422 if session is not function_head."""
    headers_a = two_tenants["headers_a"]

    # Create sme session
    resp = real_client.post("/api/scout/sessions", json={
        "type": "sme",
        "interviewee_name": "Test SME",
    }, headers=headers_a)
    session_id = resp.json()["id"]

    # Create work system
    resp = real_client.post("/api/work-systems", json={
        "code": "offer-day1-4",
        "name": "Offer to Day-1",
        "entry": "Recruiter request received",
        "exit": "Day-1 ready",
        "owner": "HR Ops",
        "outcome": "Hire is complete"
    }, headers=headers_a)
    work_system_id = resp.json()["id"]

    # Try to draft
    resp = real_client.post(f"/api/work-systems/{work_system_id}/draft-strategy-intent", json={
        "focus": "some focus",
        "source_session_id": session_id
    }, headers=headers_a)
    assert resp.status_code == 422


@pg_skip
def test_get_hard_anchors_includes_dual_employment(real_client):
    """GET hard-anchors includes dual_employment and a string that exists in repo source."""
    resp = real_client.get("/api/packs/hr/hard-anchors")
    assert resp.status_code == 200
    data = resp.json()
    assert "anchors" in data
    assert len(data["anchors"]) >= 1

    # Find dual_employment anchor
    dual_emp = None
    for anchor in data["anchors"]:
        if anchor["key"] == "dual_employment":
            dual_emp = anchor
            break

    assert dual_emp is not None, "dual_employment anchor not found"
    assert "label" in dual_emp
    assert "prompt" in dual_emp

    # Check that the prompt contains text from repo source
    # (substring of Document check stop copy or offer-desk sheet text)
    prompt_text = dual_emp["prompt"]
    assert "dual employment" in prompt_text.lower()
    # The text should match existing repo text
    assert "offer not released" in prompt_text or "deviation approval" in prompt_text


@pg_skip
def test_sitting_answers_guest_401_without_key(real_client):
    """Guest: 401 without key (cannot GET or PUT sitting answers)."""
    # Try GET without key
    resp = real_client.get("/api/scout/sessions/1/sitting-answers")
    assert resp.status_code == 401

    # Try PUT without key
    resp = real_client.put("/api/scout/sessions/1/sitting-answers", json={"answers": []})
    assert resp.status_code == 401


@pg_skip
def test_no_new_table_for_sitting_answers():
    """Verify sitting_answers stored in timeline_json, not a new table."""
    # This is a meta-test: if someone adds a new sitting_answers table,
    # this test documents that it violates the contract
    session = SetupSession()
    from sqlalchemy import inspect
    inspector = inspect(session.bind)
    tables = inspector.get_table_names()
    session.close()
    assert "sitting_answers" not in tables, "Contract: no new table for sitting_answers"
