"""V10-3 (docs/V10_BUILD.md): verification design + certification API
(services/verification_design.py). Real Postgres only for the positive
paths -- same reasoning test_pointers.py/test_handoff.py already give
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

CSV_CONTENT = b"Name,Value\nAlpha,100\nBeta,200\n"


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
        "DELETE FROM verification_designs WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM field_pointers WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM work_unit_provenance WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("UPDATE work_units SET genome_version_id = NULL WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM uploaded_files WHERE client_id = ANY(:ids)"), ids)
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
    key_a, cid_a = _make_tenant(session, "vd-a")
    key_b, cid_b = _make_tenant(session, "vd-b")
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
        "name": "V10-3 Verification Design Test Object", "kind": "business_object", "state_machine": '["draft","done"]',
    })
    if r.status_code == 409:
        existing = real_client.get("/api/ontology/types").json()["items"]
        return next(t["id"] for t in existing if t["name"] == "V10-3 Verification Design Test Object")
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _work_unit(real_client, headers, type_id, code) -> int:
    body = {
        "code": code, "name": "Approve thing", "business_object_type_id": type_id,
        "current_condition": "draft", "desired_condition": "approved",
        "context": "", "trigger": "request arrives", "inputs": "form",
        "authority": "", "actor_constraints": "", "acceptance_criteria": "",
        "evidence_required": "", "verification_method": "deterministic_rule",
        "sla_hours": 4, "failure_semantics": "hold and notify", "owner": "Ops",
    }
    r = real_client.post("/api/work-units/", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _upload(real_client, headers, content: bytes, name: str) -> int:
    r = real_client.post("/api/files/upload", headers=headers, files={"file": (name, content, "application/octet-stream")})
    assert r.status_code == 201, r.text
    return int(r.json()["file_id"])


def test_verification_design_rejects_missing_key(client):
    assert client.get("/api/work-units/1/verification-design").status_code == 401
    assert client.put("/api/work-units/1/verification-design", json={}).status_code == 401


@pg_skip
def test_no_design_yet_404s(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, "WU-VD-NONE")

    r = real_client.get(f"/api/work-units/{wu_id}/verification-design", headers=headers)
    assert r.status_code == 404, r.text


@pg_skip
def test_put_design_defaults(real_client, two_tenants):
    """BUILD_PROGRAM.md: method one of seven or none, sampling/cost 'not
    stated' when not given, error-cost defaults to contestable, and
    dual_track is always true (structural -- see model docstring)."""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, "WU-VD-DEFAULTS")

    r = real_client.put(f"/api/work-units/{wu_id}/verification-design", headers=headers, json={})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["method"] is None
    assert body["independence"] == "no"
    assert body["independence_required"] is False
    assert body["sampling"] == "not stated"
    assert body["cost"] is None
    assert body["error_cost"] == "contestable"
    assert body["certification"] == "cannot_define"
    assert body["checked_by"] == ""
    assert body["dual_track"] is True

    reread = real_client.get(f"/api/work-units/{wu_id}/verification-design", headers=headers)
    assert reread.status_code == 200, reread.text
    assert reread.json() == body


@pg_skip
def test_put_design_is_idempotent_upsert(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, "WU-VD-UPSERT")

    first = real_client.put(f"/api/work-units/{wu_id}/verification-design", headers=headers, json={
        "method": "human_spot_check", "sampling": "10% monthly", "cost": 25.0,
    })
    assert first.status_code == 200, first.text

    second = real_client.put(f"/api/work-units/{wu_id}/verification-design", headers=headers, json={
        "method": "cross_system_reconciliation", "sampling": "100%", "cost": 40.0,
        "independence": "different_lineage", "checked_by": "Ops Lead",
    })
    assert second.status_code == 200, second.text

    assert second.json()["id"] == first.json()["id"]
    assert second.json()["method"] == "cross_system_reconciliation"
    assert second.json()["sampling"] == "100%"
    assert second.json()["cost"] == 40.0
    assert second.json()["independence"] == "different_lineage"
    assert second.json()["checked_by"] == "Ops Lead"


@pg_skip
def test_dual_track_is_not_caller_settable(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, "WU-VD-DUALTRACK")

    r = real_client.put(
        f"/api/work-units/{wu_id}/verification-design", headers=headers,
        json={"dual_track": False, "checked_by": "Someone"},
    )
    assert r.status_code == 200, r.text
    # The schema has no such field -- a caller-supplied value is silently
    # ignored, never flips the structural do/check split off.
    assert r.json()["dual_track"] is True


@pg_skip
def test_certification_sure_rejected_while_a_predicted_pointer_exists(real_client, two_tenants):
    """BUILD_PROGRAM.md: 'predicted provenance cannot become sure'."""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, "WU-VD-PREDICTED")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    broken = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": file_id, "cell": "Z99",
    })
    assert broken.status_code == 200, broken.text
    assert broken.json()["status"] == "predicted"

    r = real_client.put(f"/api/work-units/{wu_id}/verification-design", headers=headers, json={
        "certification": "sure",
    })
    assert r.status_code == 422, r.text
    assert "sure" in r.json()["detail"].lower()

    # Nothing was persisted by the rejected attempt.
    assert real_client.get(f"/api/work-units/{wu_id}/verification-design", headers=headers).status_code == 404


@pg_skip
def test_certification_sure_allowed_without_a_predicted_pointer(real_client, two_tenants):
    """Certification is its own column, not derived from provenance/pointer
    status -- a unit with zero pointers at all may still be stated 'sure'
    by a human; only an actual predicted claim blocks it."""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, "WU-VD-SURE-OK")

    r = real_client.put(f"/api/work-units/{wu_id}/verification-design", headers=headers, json={
        "certification": "sure", "checked_by": "Ops Lead",
    })
    assert r.status_code == 200, r.text
    assert r.json()["certification"] == "sure"


@pg_skip
def test_rls_verification_design_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    type_id = _type(real_client)
    wu_a = _work_unit(real_client, headers_a, type_id, "WU-VD-RLS-A")

    created = real_client.put(f"/api/work-units/{wu_a}/verification-design", headers=headers_a, json={
        "method": "human_spot_check",
    })
    assert created.status_code == 200, created.text

    # B cannot reach A's work unit at all -- 404, not a redacted 200.
    assert real_client.get(f"/api/work-units/{wu_a}/verification-design", headers=headers_b).status_code == 404
    cross_write = real_client.put(
        f"/api/work-units/{wu_a}/verification-design", headers=headers_b, json={"method": "outcome_delay"},
    )
    assert cross_write.status_code == 404, cross_write.text

    # A's own read is unaffected.
    own = real_client.get(f"/api/work-units/{wu_a}/verification-design", headers=headers_a)
    assert own.status_code == 200, own.text
    assert own.json()["method"] == "human_spot_check"
