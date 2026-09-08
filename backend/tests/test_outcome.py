"""V10-5 (docs/NEXT.md): outcome record API (services/outcome.py). Real
Postgres only for the positive paths -- same reasoning
test_verification_design.py / test_work_systems.py already give
(TenantDbDep's `SET app.current_client_id` is Postgres-only syntax SQLite
can't execute).
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
    session.execute(text(
        "DELETE FROM outcome_records WHERE work_system_id IN (SELECT id FROM work_systems WHERE client_id = ANY(:ids))"
    ), ids)
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
    key_a, cid_a = _make_tenant(session, "oc-a")
    key_b, cid_b = _make_tenant(session, "oc-b")
    session.commit()
    session.close()

    yield {
        "key_a": key_a, "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a},
        "key_b": key_b, "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b},
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


PROMISED_SENTENCE = "Candidate handed over, Day-1 ready"


def _ensure_body(**overrides) -> dict:
    body = {
        "code": "WS-OFFER-ONBOARD",
        "name": "Recruiter asks for offer -> offer released -> Day-1 ready",
        "entry": "Recruiter sends offer request",
        "exit": "New hire fully onboarded",
        "owner": "Head of HR operations (stand-in)",
        "outcome": PROMISED_SENTENCE,
    }
    body.update(overrides)
    return body


def _work_system(real_client, headers, **overrides) -> int:
    r = real_client.post("/api/work-systems", headers=headers, json=_ensure_body(**overrides))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_outcome_rejects_missing_key(client):
    assert client.get("/api/work-systems/1/outcome").status_code == 401
    assert client.put("/api/work-systems/1/outcome", json={"measured": "58%", "source": "Payroll export"}).status_code == 401


@pg_skip
def test_get_outcome_defaults_to_not_measured(real_client, two_tenants):
    """Contract default: promised = the Work System's own sitting outcome
    sentence (sourced from Offer Desk meta at ensure time), measured = null,
    status = not_measured -- and this is a real row a GET returns, not a
    404 a caller has to special-case."""
    headers = two_tenants["headers_a"]
    ws_id = _work_system(real_client, headers)

    r = real_client.get(f"/api/work-systems/{ws_id}/outcome", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["work_system_id"] == ws_id
    assert body["promised"] == PROMISED_SENTENCE
    assert body["measured"] is None
    assert body["status"] == "not_measured"


@pg_skip
def test_get_outcome_is_idempotent(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    ws_id = _work_system(real_client, headers)

    first = real_client.get(f"/api/work-systems/{ws_id}/outcome", headers=headers).json()
    second = real_client.get(f"/api/work-systems/{ws_id}/outcome", headers=headers).json()
    assert second["id"] == first["id"]
    assert second == first


@pg_skip
def test_put_measured_rejects_text_with_no_number(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    ws_id = _work_system(real_client, headers)

    r = real_client.put(
        f"/api/work-systems/{ws_id}/outcome", headers=headers,
        json={"measured": "Went great, on schedule", "source": "HRBP sit-down, Sep 2026"},
    )
    assert r.status_code == 422, r.text

    # Never invent 62% -- a rejected PUT must not leave the row measured.
    reread = real_client.get(f"/api/work-systems/{ws_id}/outcome", headers=headers)
    assert reread.json()["status"] == "not_measured"
    assert reread.json()["measured"] is None


@pg_skip
def test_put_measured_rejects_blank_source(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    ws_id = _work_system(real_client, headers)

    r = real_client.put(
        f"/api/work-systems/{ws_id}/outcome", headers=headers,
        json={"measured": "58% Day-1 ready", "source": "   "},
    )
    assert r.status_code == 422, r.text
    assert real_client.get(f"/api/work-systems/{ws_id}/outcome", headers=headers).json()["status"] == "not_measured"


@pg_skip
def test_put_measured_requires_both_fields(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    ws_id = _work_system(real_client, headers)

    assert real_client.put(
        f"/api/work-systems/{ws_id}/outcome", headers=headers, json={"source": "Payroll export"},
    ).status_code == 422
    assert real_client.put(
        f"/api/work-systems/{ws_id}/outcome", headers=headers, json={"measured": "58%"},
    ).status_code == 422


@pg_skip
def test_put_measured_success_persists_and_leaves_promised_untouched(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    ws_id = _work_system(real_client, headers)

    r = real_client.put(
        f"/api/work-systems/{ws_id}/outcome", headers=headers,
        json={"measured": "58% Day-1 ready", "source": "Payroll export, Sep 2026"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "measured"
    assert "58%" in body["measured"]
    assert "Payroll export, Sep 2026" in body["measured"]
    assert body["promised"] == PROMISED_SENTENCE

    reread = real_client.get(f"/api/work-systems/{ws_id}/outcome", headers=headers)
    assert reread.status_code == 200, reread.text
    assert reread.json() == body


@pg_skip
def test_rls_outcome_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    ws_a = _work_system(real_client, headers_a)

    created = real_client.get(f"/api/work-systems/{ws_a}/outcome", headers=headers_a)
    assert created.status_code == 200, created.text

    # B cannot reach A's work system at all -- 404, not a redacted 200.
    assert real_client.get(f"/api/work-systems/{ws_a}/outcome", headers=headers_b).status_code == 404
    cross_write = real_client.put(
        f"/api/work-systems/{ws_a}/outcome", headers=headers_b,
        json={"measured": "99%", "source": "fabricated"},
    )
    assert cross_write.status_code == 404, cross_write.text

    # A's own record is unaffected.
    own = real_client.get(f"/api/work-systems/{ws_a}/outcome", headers=headers_a)
    assert own.status_code == 200, own.text
    assert own.json()["status"] == "not_measured"
