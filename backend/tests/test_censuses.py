"""V10-1 BACKEND (docs/V10_BUILD.md): censuses get-or-create + start +
readiness. Real Postgres only for the positive paths -- TenantDbDep's
`SET app.current_client_id` is Postgres-specific syntax SQLite can't
execute (same reason test_rls_http.py / test_work_systems.py are
real-Postgres-only); the SQLite `client` fixture is fine for the
missing-key 401 case since that never reaches tenant_db()."""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

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


def _make_work_system(session, client_id, code="WS-TEST"):
    return session.execute(text(
        "INSERT INTO work_systems (client_id, code, name, entry, exit, owner, outcome, status, ratified_by, "
        "function_intent_outcome, function_intent_owner, function_intent_measure, "
        "work_system_intent_purpose, work_system_intent_owner, work_system_intent_confirmed_by, "
        "function_intent_confirmed_by, created_at, updated_at) "
        "VALUES (:cid, :code, 'Test journey', '', '', '', '', 'candidate', '', "
        "'', '', '', '', '', '', '', now(), now()) RETURNING id"
    ), {"cid": client_id, "code": code}).scalar()


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
    session.execute(text("DELETE FROM censuses WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM scout_captured_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM scout_interview_sessions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM uploaded_files WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM consent_receipts WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_systems WHERE client_id = ANY(:ids)"), ids)
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
    key_a, cid_a = _make_tenant(session, "cen-a")
    key_b, cid_b = _make_tenant(session, "cen-b")
    ws_a = _make_work_system(session, cid_a)
    ws_b = _make_work_system(session, cid_b)
    session.commit()
    session.close()

    yield {
        "key_a": key_a, "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a}, "ws_a": ws_a,
        "key_b": key_b, "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b}, "ws_b": ws_b,
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


def test_censuses_rejects_missing_key(client):
    assert client.get("/api/censuses").status_code == 401
    assert client.post("/api/censuses", json={"work_system_id": 1}).status_code == 401


@pg_skip
def test_ensure_creates_draft_row_with_honest_empty_readiness(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_a = two_tenants["ws_a"]

    empty = real_client.get("/api/censuses", headers=headers_a)
    assert empty.status_code == 200, empty.text
    assert empty.json()["items"] == []

    created = real_client.post("/api/censuses", headers=headers_a, json={"work_system_id": ws_a})
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["work_system_id"] == ws_a
    assert row["status"] == "draft"
    assert row["started_at"] is None
    assert row["scope"] == {}
    assert row["document_requests"] == []

    # A brand-new tenant has no consent, no scout sessions, no files --
    # every readiness boolean must honestly read false, not a stubbed true.
    readiness = row["readiness"]
    assert readiness["consent"] is False
    assert readiness["consent_receipt_count"] == 0
    assert readiness["people"] is False
    assert readiness["people_seats_filled"] == 0
    assert readiness["people_seats_total"] == 3
    assert readiness["docs"] is False
    assert readiness["docs_uploaded_count"] == 0

    listed = real_client.get("/api/censuses", headers=headers_a)
    assert listed.json()["total"] == 1


@pg_skip
def test_ensure_is_idempotent_and_never_overwrites_existing_row(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_a = two_tenants["ws_a"]
    first = real_client.post(
        "/api/censuses", headers=headers_a,
        json={"work_system_id": ws_a, "scope": {"function": "HR"}},
    ).json()

    # A second ensure call with a different scope must return the SAME row
    # unchanged, not overwrite it -- same rule work_systems' own ensure follows.
    second = real_client.post(
        "/api/censuses", headers=headers_a,
        json={"work_system_id": ws_a, "scope": {"function": "Finance"}},
    )
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first["id"]
    assert second.json()["scope"] == {"function": "HR"}

    listed = real_client.get("/api/censuses", headers=headers_a).json()
    assert listed["total"] == 1


@pg_skip
def test_ensure_rejects_unknown_or_cross_tenant_work_system(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_b = two_tenants["ws_b"]

    missing = real_client.post("/api/censuses", headers=headers_a, json={"work_system_id": 999999})
    assert missing.status_code == 404, missing.text

    cross = real_client.post("/api/censuses", headers=headers_a, json={"work_system_id": ws_b})
    assert cross.status_code == 404, cross.text


@pg_skip
def test_start_sets_status_and_timestamp_and_survives_refresh(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_a = two_tenants["ws_a"]
    census_id = real_client.post("/api/censuses", headers=headers_a, json={"work_system_id": ws_a}).json()["id"]

    started = real_client.post(f"/api/censuses/{census_id}/start", headers=headers_a)
    assert started.status_code == 200, started.text
    row = started.json()
    assert row["status"] == "started"
    assert row["started_at"] is not None

    # Survives a fresh read/refresh, not just the response of the start call itself.
    reread = real_client.get("/api/censuses", headers=headers_a).json()["items"][0]
    assert reread["status"] == "started"
    assert reread["started_at"] is not None


@pg_skip
def test_start_twice_is_rejected(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_a = two_tenants["ws_a"]
    census_id = real_client.post("/api/censuses", headers=headers_a, json={"work_system_id": ws_a}).json()["id"]

    first = real_client.post(f"/api/censuses/{census_id}/start", headers=headers_a)
    assert first.status_code == 200, first.text

    again = real_client.post(f"/api/censuses/{census_id}/start", headers=headers_a)
    assert again.status_code == 409, again.text


@pg_skip
def test_rls_censuses_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    ws_a = two_tenants["ws_a"]
    ws_b = two_tenants["ws_b"]

    census_a = real_client.post("/api/censuses", headers=headers_a, json={"work_system_id": ws_a}).json()
    census_b = real_client.post("/api/censuses", headers=headers_b, json={"work_system_id": ws_b}).json()
    assert census_b["id"] != census_a["id"]

    # B never sees A's row in its own list.
    listed_b = real_client.get("/api/censuses", headers=headers_b).json()["items"]
    assert all(row["id"] != census_a["id"] for row in listed_b)

    # B cannot start A's row by id -- 404, not a cross-tenant write.
    cross_start = real_client.post(f"/api/censuses/{census_a['id']}/start", headers=headers_b)
    assert cross_start.status_code == 404, cross_start.text

    # A's row is unaffected by B's attempt.
    still_draft = real_client.get("/api/censuses", headers=headers_a).json()["items"][0]
    assert still_draft["status"] == "draft"


@pg_skip
def test_readiness_reflects_existing_consent_scout_and_files(real_client, two_tenants):
    """The core V10-1 rule: readiness booleans come from EXISTING data --
    no document-request workflow is invented. This test writes directly
    into the three real source tables (consent_receipts,
    scout_interview_sessions, uploaded_files) the same way their own
    routers do, then confirms GET /api/censuses reflects them without any
    census-specific write."""
    headers_a = two_tenants["headers_a"]
    client_a_id = two_tenants["client_a_id"]
    ws_a = two_tenants["ws_a"]
    real_client.post("/api/censuses", headers=headers_a, json={"work_system_id": ws_a})

    session = SetupSession()
    now = datetime.now(timezone.utc)
    session.execute(text(
        "INSERT INTO consent_receipts (client_id, interview_ref, data_principal_initials, purpose, "
        "consent_text, consent_timestamp, retention_days, withdrawal_method, auto_purge_at, status) "
        "VALUES (:cid, 'ref', 'AB', 'census', 'I consent', :now, 90, '', :purge, 'active')"
    ), {"cid": client_a_id, "now": now, "purge": now + timedelta(days=90)})
    # Only 2 of 3 seats filled on purpose -- "people" must stay false until all three sit.
    for seat_type in ("function_head", "sub_function_lead"):
        session.execute(text(
            "INSERT INTO scout_interview_sessions (client_id, type, interviewee_name, status, "
            "completeness_pct, timeline_json, created_at, updated_at) "
            "VALUES (:cid, :t, 'Someone', 'in_progress', 0, '{}', now(), now())"
        ), {"cid": client_a_id, "t": seat_type})
    session.execute(text(
        "INSERT INTO uploaded_files (client_id, file_name, sha256, content_type, size_bytes, uploaded_by, uploaded_at) "
        "VALUES (:cid, 'sheet.csv', :sha, 'text/csv', 10, 'test', now())"
    ), {"cid": client_a_id, "sha": "a" * 64})
    session.commit()
    session.close()

    row = real_client.get("/api/censuses", headers=headers_a).json()["items"][0]
    readiness = row["readiness"]
    assert readiness["consent"] is True
    assert readiness["consent_receipt_count"] == 1
    assert readiness["people"] is False
    assert readiness["people_seats_filled"] == 2
    assert readiness["docs"] is True
    assert readiness["docs_uploaded_count"] == 1

    # Fill the third seat -- people must flip true, no other signal touched.
    session = SetupSession()
    session.execute(text(
        "INSERT INTO scout_interview_sessions (client_id, type, interviewee_name, status, "
        "completeness_pct, timeline_json, created_at, updated_at) "
        "VALUES (:cid, 'sme', 'Someone else', 'in_progress', 0, '{}', now(), now())"
    ), {"cid": client_a_id})
    session.commit()
    session.close()

    row = real_client.get("/api/censuses", headers=headers_a).json()["items"][0]
    assert row["readiness"]["people"] is True
    assert row["readiness"]["people_seats_filled"] == 3
