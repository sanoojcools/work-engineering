"""Scout Elevated V2 PR2: Time-Travel Replay (deterministic timeline) +
Contradiction Resolver (deterministic function-head-vs-SME diff). No LLM in
either -- see services/scout_timeline.py and services/scout_contradictions.py
docstrings. Same _make_tenant/pg_skip/cleanup pattern as test_rls_http.py.
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
    raw_key = f"test-{slug}-key-" + "e" * 20
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
    session.execute(text("DELETE FROM scout_contradictions WHERE client_id = ANY(:ids)"), ids)
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
def tenant():
    session = SetupSession()
    key, cid = _make_tenant(session, "elev-a")
    session.commit()
    session.close()
    yield {"key": key, "client_id": cid, "headers": {"X-Spec-Key": key}}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


@pytest.fixture
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "elev-b")
    key_b, cid_b = _make_tenant(session, "elev-c")
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
def test_timeline_places_blocks_and_finds_gap(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]

    # Two daily-frequency units: 08:00-09:00, 09:00-10:00 -- then a gap
    # until 20:00 (a 10-hour gap, well above the 30-min noise threshold).
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={
        "name": "Morning Standup", "frequency": "daily", "time_minutes": 60,
    })
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={
        "name": "Inbox Triage", "frequency": "daily", "time_minutes": 60,
    })

    timeline = real_client.get(f"/api/scout/sessions/{sid}/timeline", headers=headers)
    assert timeline.status_code == 200, timeline.text
    body = timeline.json()
    assert len(body["blocks"]) == 2
    assert body["total_minutes"] == 120
    assert body["over_allocated"] is False
    assert any(g["minutes"] >= 300 for g in body["gaps"])


@pg_skip
def test_timeline_over_allocation_flagged(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={
        "name": "Deep Work Block", "frequency": "daily", "time_minutes": 800,  # 13.3 hrs > 720-min (12hr) window
    })
    timeline = real_client.get(f"/api/scout/sessions/{sid}/timeline", headers=headers)
    assert timeline.json()["over_allocated"] is True


@pg_skip
def test_timeline_manual_edit_persists_and_survives_get(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    real_client.get(f"/api/scout/sessions/{sid}/timeline", headers=headers)  # seeds it

    edited = real_client.patch(f"/api/scout/sessions/{sid}/timeline", headers=headers, json={
        "timeline": {
            "day_start_min": 540, "day_end_min": 1080, "blocks": [], "gaps": [],
            "total_minutes": 0, "over_allocated": False, "unplaced_units": [],
            "manual_note": "added a block by hand",
        },
    })
    assert edited.status_code == 200, edited.text

    refetched = real_client.get(f"/api/scout/sessions/{sid}/timeline", headers=headers)
    assert refetched.json()["manual_note"] == "added a block by hand"


@pg_skip
def test_contradiction_detected_between_function_head_and_sme(real_client, tenant):
    headers = tenant["headers"]
    function_head_sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "function_head", "interviewee_name": "Function Head",
    }).json()["id"]
    sme_sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]

    real_client.post(f"/api/scout/sessions/{function_head_sid}/units", headers=headers, json={
        "name": "Payroll Run", "systems": "HRIS only", "frequency": "monthly",
    })
    real_client.post(f"/api/scout/sessions/{sme_sid}/units", headers=headers, json={
        "name": "payroll run", "systems": "HRIS, Excel, WhatsApp", "frequency": "monthly",
    })

    listed = real_client.get("/api/scout/contradictions", headers=headers)
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    assert len(items) == 1
    c = items[0]
    assert c["unit_name"].lower() == "payroll run"
    assert c["field"] == "systems"
    assert c["status"] == "open"

    resolved = real_client.post(f"/api/scout/contradictions/{c['id']}/resolve", headers=headers, json={
        "resolution": "Real process uses Excel + WhatsApp for exceptions; HRIS is the official record only.",
    })
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "resolved"

    # Resolved contradictions aren't re-flagged as duplicates on the next scan.
    listed_again = real_client.get("/api/scout/contradictions", headers=headers)
    assert len(listed_again.json()["items"]) == 1


@pg_skip
def test_no_contradiction_when_answers_agree(real_client, tenant):
    headers = tenant["headers"]
    function_head_sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "function_head", "interviewee_name": "Function Head",
    }).json()["id"]
    sme_sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    real_client.post(f"/api/scout/sessions/{function_head_sid}/units", headers=headers, json={
        "name": "Onboarding", "systems": "HRIS",
    })
    real_client.post(f"/api/scout/sessions/{sme_sid}/units", headers=headers, json={
        "name": "Onboarding", "systems": "HRIS",
    })
    listed = real_client.get("/api/scout/contradictions", headers=headers)
    assert listed.json()["items"] == []


@pg_skip
def test_contradictions_isolated_across_tenants(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    f_a = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "function_head", "interviewee_name": "F",
    }).json()["id"]
    s_a = real_client.post("/api/scout/sessions", headers=headers_a, json={
        "type": "sme", "interviewee_name": "S",
    }).json()["id"]
    real_client.post(f"/api/scout/sessions/{f_a}/units", headers=headers_a, json={
        "name": "X", "systems": "A",
    })
    real_client.post(f"/api/scout/sessions/{s_a}/units", headers=headers_a, json={
        "name": "X", "systems": "B",
    })

    listed_b = real_client.get("/api/scout/contradictions", headers=headers_b)
    assert listed_b.json()["items"] == []


@pg_skip
def test_scout_elevations_no_key_401(real_client):
    no_header = {}
    assert real_client.get("/api/scout/sessions/1/timeline", headers=no_header).status_code == 401
    assert real_client.get("/api/scout/contradictions", headers=no_header).status_code == 401
