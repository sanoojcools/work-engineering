"""Scout Elevated V2 PR3: Pain & Automation X-Ray (deterministic keyword
heuristic, no sentiment model) + Story to Structure (deterministic sentence
chunker -- LLM_PROVIDER=none in this environment, so used_llm is always
False here; see services/scout_pain.py and services/scout_story.py).
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
    raw_key = f"test-{slug}-key-" + "p" * 20
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
    key, cid = _make_tenant(session, "pain-a")
    session.commit()
    session.close()
    yield {"key": key, "client_id": cid, "headers": {"X-Spec-Key": key}}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


@pg_skip
def test_pain_heatmap_ranks_systems_by_time_and_pain(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={
        "name": "Reconcile Attendance", "systems": "Excel", "frequency": "daily",
        "time_minutes": 90, "pain": "totally manual copy paste, painful and tedious",
    })
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={
        "name": "Send Offer Letter", "systems": "HRIS", "frequency": "weekly",
        "time_minutes": 10, "pain": "",
    })

    heatmap = real_client.get(f"/api/scout/sessions/{sid}/pain-heatmap", headers=headers)
    assert heatmap.status_code == 200, heatmap.text
    body = heatmap.json()
    assert len(body["systems"]) == 2
    top = body["top_pain_points"][0]
    assert top["system"] == "Excel"
    assert top["copy_paste_count"] >= 2
    assert top["avg_pain_score"] > 0
    assert 0 < top["automation_potential_pct"] <= 100


@pg_skip
def test_pain_heatmap_empty_session(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    heatmap = real_client.get(f"/api/scout/sessions/{sid}/pain-heatmap", headers=headers)
    assert heatmap.status_code == 200
    assert heatmap.json()["systems"] == []


@pg_skip
def test_story_extraction_deterministic_fallback(real_client, tenant):
    headers = tenant["headers"]
    story = (
        "Last Tuesday a client emailed asking for a refund. "
        "I checked the order in the ERP. "
        "Then I escalated it to finance because it was over the approval limit."
    )
    extracted = real_client.post("/api/scout/extract-from-story", headers=headers, json={
        "transcript_chunk": story,
    })
    assert extracted.status_code == 200, extracted.text
    body = extracted.json()
    assert body["used_llm"] is False
    assert len(body["chunks"]) == 3
    # Guardrail: every chunk is a literal substring of what was said.
    for chunk in body["chunks"]:
        assert chunk["text"] in story
    assert "no llm configured" in body["note"].lower()


@pg_skip
def test_scout_pr3_no_key_401(real_client):
    no_header = {}
    assert real_client.get("/api/scout/sessions/1/pain-heatmap", headers=no_header).status_code == 401
    assert real_client.post(
        "/api/scout/extract-from-story", headers=no_header, json={"transcript_chunk": "x"}
    ).status_code == 401
