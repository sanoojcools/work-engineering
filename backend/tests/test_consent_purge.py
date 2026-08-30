"""Slice 3 PR 3c: consent receipts + 90-day auto-purge. Real Postgres only —
tenant_db() runs `SET app.current_client_id`, Postgres-specific syntax
SQLite can't execute (same reason as test_rls_http.py /
test_org_key_migration.py). _make_tenant / pg_skip / teardown order follow
test_rls_http.py (e67e499) exactly; consent_receipts is added to the
cleanup list before the clients DELETE.
"""
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
    """No key-issuance endpoint exists yet — every tenant fixture in this
    repo mints its org_api_keys row with a direct insert (test_rls_http.py)."""
    raw_key = f"test-{slug}-key-" + "c" * 20
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
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "consent-a")
    key_b, cid_b = _make_tenant(session, "consent-b")
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
def test_consent_create_and_list_isolated(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]

    created = real_client.post("/api/consent/receipts", headers=headers_a, json={
        "subject_id": "interview-001", "purpose": "hr_ops_genome",
    })
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["subject_id"] == "interview-001"
    assert body["status"] == "active"
    assert body["expires_at"] is not None
    rid = body["id"]

    # A can read its own receipt.
    own = real_client.get(f"/api/consent/receipts/{rid}", headers=headers_a)
    assert own.status_code == 200, own.text

    # B gets 404 on the same id, not a redacted 200.
    cross = real_client.get(f"/api/consent/receipts/{rid}", headers=headers_b)
    assert cross.status_code == 404, cross.text

    # Lists are disjoint.
    listed_a = {r["id"] for r in real_client.get("/api/consent/receipts", headers=headers_a).json()["items"]}
    listed_b = {r["id"] for r in real_client.get("/api/consent/receipts", headers=headers_b).json()["items"]}
    assert rid in listed_a
    assert rid not in listed_b
    assert listed_a.isdisjoint(listed_b)


@pg_skip
def test_consent_no_key_401(real_client):
    no_header = {}
    wrong = {"X-Spec-Key": "not-a-real-key"}
    for headers in (no_header, wrong):
        assert real_client.post("/api/consent/receipts", headers=headers, json={
            "subject_id": "x", "purpose": "census",
        }).status_code == 401
        assert real_client.get("/api/consent/receipts", headers=headers).status_code == 401


@pg_skip
def test_purge_job_reports_zero_when_nothing_expired(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    created = real_client.post("/api/consent/receipts", headers=headers_a, json={
        "subject_id": "interview-fresh", "purpose": "census",
    })
    assert created.status_code == 201, created.text

    purged = real_client.post("/api/admin/consent/purge")
    assert purged.status_code == 200, purged.text
    assert purged.json()["purged"] == 0

    still_active = real_client.get(f"/api/consent/receipts/{created.json()['id']}", headers=headers_a)
    assert still_active.json()["status"] == "active"


@pg_skip
def test_purge_job_tombstones_expired(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    cid_a = two_tenants["client_a_id"]

    # No backdate path over HTTP by design (expires_at is server-computed
    # from consent_timestamp + retention_days) — same as test_rls_http.py's
    # direct-insert tenant fixtures, this backdates via direct DB insert.
    session = SetupSession()
    past = datetime.now(timezone.utc) - timedelta(days=1)
    consented = past - timedelta(days=90)
    receipt_id = session.execute(text(
        "INSERT INTO consent_receipts "
        "(client_id, interview_ref, data_principal_initials, purpose, consent_text, "
        "consent_timestamp, retention_days, withdrawal_method, auto_purge_at, status) "
        "VALUES (:cid, 'interview-expired', '', 'hr_ops_genome', '', "
        ":consented, 90, '', :expires, 'active') "
        "RETURNING id"
    ), {"cid": cid_a, "consented": consented, "expires": past}).scalar()
    session.commit()
    session.close()

    purged = real_client.post("/api/admin/consent/purge")
    assert purged.status_code == 200, purged.text
    assert purged.json()["purged"] == 1

    after = real_client.get(f"/api/consent/receipts/{receipt_id}", headers=headers_a)
    assert after.status_code == 200, after.text
    assert after.json()["status"] == "purged"
    assert after.json()["purged_at"] is not None


@pg_skip
def test_consent_revoked_not_purged_again(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    created = real_client.post("/api/consent/receipts", headers=headers_a, json={
        "subject_id": "interview-revoke", "purpose": "census",
    })
    rid = created.json()["id"]

    revoked = real_client.post(f"/api/consent/receipts/{rid}/revoke", headers=headers_a, json={
        "withdrawal_method": "subject request",
    })
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "withdrawn"
    assert revoked.json()["revoked_at"] is not None

    # Backdate the (already withdrawn) receipt's expiry so it would be
    # purge-eligible on timing alone, then prove the purge job skips it —
    # a withdrawn receipt's exit was already recorded; the timer isn't a
    # second purge path for it.
    session = SetupSession()
    session.execute(text(
        "UPDATE consent_receipts SET auto_purge_at = :past WHERE id = :rid"
    ), {"past": datetime.now(timezone.utc) - timedelta(days=1), "rid": rid})
    session.commit()
    session.close()

    purged = real_client.post("/api/admin/consent/purge")
    assert purged.status_code == 200, purged.text
    assert purged.json()["purged"] == 0

    after = real_client.get(f"/api/consent/receipts/{rid}", headers=headers_a)
    assert after.json()["status"] == "withdrawn"
    assert after.json()["purged_at"] is None
