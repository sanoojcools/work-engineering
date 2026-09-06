"""Scout Elevated V2 PR4: Future Preview + "Generate V8 Work Units" ->
the EXISTING genome import pipeline, best-effort mapped from captured
units (services/scout_genome.py). Same GQS gate as any other import --
a thin Scout session's genome is expected to fail it, not pass by a
relaxed rule. See that module's docstring for exactly what's real vs.
an honest placeholder in the mapping.
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
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM scout_contradictions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM scout_captured_units WHERE session_id IN "
        "(SELECT id FROM scout_interview_sessions WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM scout_interview_sessions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM consent_receipts WHERE client_id = ANY(:ids)"), ids)
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
    key, cid = _make_tenant(session, "future-a")
    session.commit()
    session.close()
    yield {"key": key, "client_id": cid, "headers": {"X-Spec-Key": key}}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


@pg_skip
def test_future_preview_locked_below_100(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={"name": "Onboarding"})

    preview = real_client.get(f"/api/scout/sessions/{sid}/future-preview", headers=headers)
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["unlocked"] is False
    assert body["completeness_pct"] < 100
    assert body["business_objects_preview"] == ["Onboarding"]


@pg_skip
def test_generate_genome_uses_real_import_pipeline_and_gate(real_client, tenant):
    headers = tenant["headers"]
    # Slice 2.1: generate-genome now 4xx's outright without a consent
    # receipt attached (see test_generate_genome_without_consent_4xx below)
    # -- a real receipt is needed here so this test can still isolate what
    # it actually means to test: that generate-genome wraps the real import
    # pipeline and its GQS gate, not the consent gate.
    receipt_id = real_client.post("/api/consent/receipts", headers=headers, json={
        "subject_id": "Anjali", "purpose": "Scout discovery interview",
    }).json()["id"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali", "consent_receipt_id": receipt_id,
    }).json()["id"]
    # Thin unit -- most of the 18 attrs will be honest placeholders, so
    # this is EXPECTED to fail (or at least not lie about passing) the
    # same GQS gate every other import goes through.
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={"name": "Onboarding"})

    generated = real_client.post(f"/api/scout/sessions/{sid}/generate-genome", headers=headers)
    assert generated.status_code == 200, generated.text
    body = generated.json()
    assert "accepted" in body
    assert "gqs" in body
    assert body["work_unit_count"] == 1
    assert isinstance(body["accepted"], bool)

    # Whatever the gate decided, a real GenomeVersion row exists -- this
    # actually went through services/genome_import.import_genome, not a
    # simulated result.
    session_row = SetupSession()
    count = session_row.execute(text(
        "SELECT count(*) FROM genome_versions WHERE client_id = :cid"
    ), {"cid": tenant["client_id"]}).scalar()
    session_row.close()
    assert count == 1


@pg_skip
def test_generate_genome_empty_session_400(real_client, tenant):
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    generated = real_client.post(f"/api/scout/sessions/{sid}/generate-genome", headers=headers)
    assert generated.status_code == 400, generated.text


@pg_skip
def test_generate_genome_without_consent_receipt_4xx(real_client, tenant):
    """Slice 2.1: the API already rejects a missing/invalid
    provenance.consent_receipt_id deep in genome_import.py's own gate
    (test_scout_consent_gate.py) -- this proves the Scout HTTP path fails
    the same way at the door, as a real 4xx, not a 200 with accepted=false,
    since the new consent screen (ConsentGate.tsx) means a caller only
    reaches this without one by skipping that screen."""
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={"name": "Onboarding"})

    generated = real_client.post(f"/api/scout/sessions/{sid}/generate-genome", headers=headers)
    assert 400 <= generated.status_code < 500, generated.text

    # No GenomeVersion row at all -- unlike a GQS-blocked attempt, this
    # never reaches the import pipeline, so nothing gets recorded.
    session_row = SetupSession()
    count = session_row.execute(text(
        "SELECT count(*) FROM genome_versions WHERE client_id = :cid"
    ), {"cid": tenant["client_id"]}).scalar()
    session_row.close()
    assert count == 0


@pg_skip
def test_attach_consent_receipt_then_generate_runs_existing_path(real_client, tenant):
    """Once a real, active receipt is attached (via the new PATCH endpoint
    the consent screen calls), generate-genome runs the existing pipeline
    again -- GQS may still correctly block a thin Scout-mapped genome; that
    is not this gate's job to override."""
    headers = tenant["headers"]
    sid = real_client.post("/api/scout/sessions", headers=headers, json={
        "type": "sme", "interviewee_name": "Anjali",
    }).json()["id"]
    real_client.post(f"/api/scout/sessions/{sid}/units", headers=headers, json={"name": "Onboarding"})

    receipt_id = real_client.post("/api/consent/receipts", headers=headers, json={
        "subject_id": "Anjali", "purpose": "Scout discovery interview",
    }).json()["id"]
    attached = real_client.patch(
        f"/api/scout/sessions/{sid}/consent-receipt", headers=headers,
        json={"consent_receipt_id": receipt_id},
    )
    assert attached.status_code == 200, attached.text
    assert attached.json()["consent_receipt_id"] == receipt_id

    generated = real_client.post(f"/api/scout/sessions/{sid}/generate-genome", headers=headers)
    assert generated.status_code == 200, generated.text
    # Whatever GQS decides for this thin genome, it is decided -- not
    # short-circuited by a missing-consent 4xx any more.
    assert "gqs" in generated.json()


@pg_skip
def test_attach_consent_receipt_cross_tenant_404(real_client, tenant):
    headers = tenant["headers"]
    setup = SetupSession()
    other_key, other_cid = _make_tenant(setup, "future-b")
    setup.commit()
    setup.close()
    try:
        sid = real_client.post("/api/scout/sessions", headers=headers, json={
            "type": "sme", "interviewee_name": "Anjali",
        }).json()["id"]
        other_receipt_id = real_client.post(
            "/api/consent/receipts", headers={"X-Spec-Key": other_key},
            json={"subject_id": "Someone Else", "purpose": "Unrelated"},
        ).json()["id"]

        attached = real_client.patch(
            f"/api/scout/sessions/{sid}/consent-receipt", headers=headers,
            json={"consent_receipt_id": other_receipt_id},
        )
        assert attached.status_code == 404, attached.text
    finally:
        _cleanup(SetupSession(), [other_cid])


@pg_skip
def test_scout_pr4_no_key_401(real_client):
    no_header = {}
    assert real_client.get("/api/scout/sessions/1/future-preview", headers=no_header).status_code == 401
    assert real_client.post("/api/scout/sessions/1/generate-genome", headers=no_header).status_code == 401
