"""V9 Slice C: talk-only persist must stay empty.

This test fails if talk-only persist returns success with saved_count > 0.
It calls the existing generate / GQS path through the Offer Desk wrapper.
It does not invent observed provenance or treat the sheet as Zwayam.
"""
from __future__ import annotations

import hashlib
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

PG_URL = os.environ.get("WE_TEST_PG_URL", "postgresql+psycopg2://wep:wep@localhost:5433/wep")
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
    raw_key = f"test-{slug}-key-" + "f" * 20
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
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "UPDATE work_units SET genome_version_id = NULL WHERE client_id = ANY(:ids)"
    ), ids)
    # Gate 6/10 (docs/BUILD_PROGRAM.md Track 1) can leave conformance_gaps
    # rows referencing these work units -- must clear before the FK below.
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM scout_contradictions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM scout_captured_units WHERE session_id IN "
        "(SELECT id FROM scout_interview_sessions WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM scout_interview_sessions WHERE client_id = ANY(:ids)"), ids)
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
    key, cid = _make_tenant(session, "v9-persist-a")
    session.commit()
    session.close()
    yield {"key": key, "client_id": cid, "headers": {"X-Spec-Key": key}}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


def _rashmi_session(client, headers):
    sid = client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Rashmi KN (Offer Desk)",
    }).json()["id"]
    # Sheet language for step 2 — declared interview row, not a Zwayam event.
    row = client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={
        "name": "2. Verify candidate documents",
        "inputs": "READ: All uploaded docs in Zwayam",
        "outputs": "WRITE: Verification status, missing doc notifications",
        "systems": "Zwayam + OneDrive",
        "frequency": "Per candidate",
        "pain": "Employment verification is the heaviest, most manual part of the role.",
        "handoffs": "Rashmi -> Recruiter (if docs missing)",
        "decision_rule": "IF dual employment detected in UAN: do NOT release offer",
        "time_minutes": 35,
    })
    assert row.status_code == 201, row.text
    return sid


def _inventory(client_id):
    session = SetupSession()
    count = session.execute(text(
        "SELECT count(*) FROM work_units WHERE client_id = :cid"
    ), {"cid": client_id}).scalar()
    session.close()
    return count


@pg_skip
def test_talk_only_persist_denied_saved_count_zero(real_client, tenant):
    headers = tenant["headers"]
    before = _inventory(tenant["client_id"])
    sid = _rashmi_session(real_client, headers)

    denied = real_client.post(
        f"/api/scout/sessions/{sid}/persist-talk-only",
        headers=headers,
        json={"sheet_attached": False},
    )
    assert denied.status_code == 200, denied.text
    body = denied.json()

    assert body["accepted"] is False, (
        "talk-only persist must not succeed; completeness is not clearance"
    )
    assert body["saved_count"] == 0, (
        "talk-only persist must not write work units; "
        f"got saved_count={body['saved_count']}"
    )
    assert "completeness_is_not_clearance" in body["reasons"]
    assert "gqs_gate" in body["reasons"] or any(
        r != "completeness_is_not_clearance" for r in body["reasons"]
    )
    assert body["provenance"] == "declared"
    assert body["ratification_accepted"] is False
    assert body["zwayam_events_claimed"] == 0
    assert body["talk_only"] is True
    assert _inventory(tenant["client_id"]) == before


@pg_skip
def test_sheet_attach_stays_declared_and_unsaved(real_client, tenant):
    headers = tenant["headers"]
    before = _inventory(tenant["client_id"])
    sid = _rashmi_session(real_client, headers)

    attached = real_client.post(
        f"/api/scout/sessions/{sid}/persist-talk-only",
        headers=headers,
        json={"sheet_attached": True},
    )
    assert attached.status_code == 200, attached.text
    body = attached.json()

    assert body["accepted"] is False
    assert body["saved_count"] == 0
    assert body["provenance"] == "declared"
    assert "sheet_is_declared_not_observed" in body["reasons"]
    assert body["zwayam_events_claimed"] == 0
    assert body["ratification_accepted"] is False
    assert _inventory(tenant["client_id"]) == before


@pg_skip
def test_persist_talk_only_empty_session_400(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "function_head", "interviewee_name": "CHRO (stand-in)",
    }).json()["id"]
    empty = real_client.post(
        f"/api/scout/sessions/{sid}/persist-talk-only",
        headers=headers,
        json={"sheet_attached": False},
    )
    assert empty.status_code == 400, empty.text


@pg_skip
def test_persist_talk_only_no_key_401(real_client):
    assert real_client.post(
        "/api/scout/sessions/1/persist-talk-only",
        json={"sheet_attached": False},
    ).status_code == 401
