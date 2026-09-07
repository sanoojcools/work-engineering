"""E -- PLAN, moderation log. Real Postgres only for the positive paths --
same reasoning test_work_systems.py's own docstring gives (TenantDbDep's
`SET app.current_client_id` is Postgres-only syntax SQLite can't execute).
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
    session.execute(text("DELETE FROM moderation_entries WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


def _make_work_unit(real_client, headers, cid, code, suffix):
    # entity_types.name is globally unique, not per-tenant -- suffix keeps
    # a fresh name every test run against a warm, already-exercised database.
    et = real_client.post("/api/ontology/types", json={
        "name": f"test-moderation-object-{cid}-{suffix}", "kind": "business_object",
    })
    assert et.status_code == 201, et.text
    wu = real_client.post("/api/work-units/", headers=headers, json={
        "code": code,
        "name": "Test moderated unit",
        "business_object_type_id": et.json()["id"],
        "current_condition": "unchecked",
        "desired_condition": "checked",
    })
    assert wu.status_code == 201, wu.text
    return wu.json()


@pytest.fixture
def two_tenants_with_units(real_client):
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "mod-a")
    key_b, cid_b = _make_tenant(session, "mod-b")
    session.commit()
    session.close()

    headers_a = {"X-Spec-Key": key_a}
    headers_b = {"X-Spec-Key": key_b}
    unit_a = _make_work_unit(real_client, headers_a, cid_a, "WU-TEST-MOD-A", "a")
    unit_b = _make_work_unit(real_client, headers_b, cid_b, "WU-TEST-MOD-B", "b")

    yield {
        "headers_a": headers_a, "client_a_id": cid_a, "unit_a": unit_a,
        "headers_b": headers_b, "client_b_id": cid_b, "unit_b": unit_b,
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


def _entry_body(**overrides) -> dict:
    body = {
        "work_unit_code": "WU-TEST-MOD-A",
        "from_level": 3,
        "to_level": 4,
        "reason": "Rashmi has run this checklist clean for six weeks straight.",
        "moderated_by": "QA Moderator",
    }
    body.update(overrides)
    return body


def test_moderation_rejects_missing_key(client):
    assert client.get("/api/moderation").status_code == 401
    assert client.post("/api/moderation", json=_entry_body()).status_code == 401


@pg_skip
def test_create_requires_a_reason(real_client, two_tenants_with_units):
    headers_a = two_tenants_with_units["headers_a"]
    empty_reason = real_client.post("/api/moderation", headers=headers_a, json=_entry_body(reason=""))
    assert empty_reason.status_code == 422, empty_reason.text


@pg_skip
def test_create_requires_a_name(real_client, two_tenants_with_units):
    headers_a = two_tenants_with_units["headers_a"]
    empty_name = real_client.post("/api/moderation", headers=headers_a, json=_entry_body(moderated_by=""))
    assert empty_name.status_code == 422, empty_name.text


@pg_skip
def test_create_rejects_a_code_with_no_real_work_unit(real_client, two_tenants_with_units):
    headers_a = two_tenants_with_units["headers_a"]
    missing = real_client.post("/api/moderation", headers=headers_a, json=_entry_body(work_unit_code="WU-DOES-NOT-EXIST"))
    assert missing.status_code == 404, missing.text


@pg_skip
def test_create_and_list_roundtrip(real_client, two_tenants_with_units):
    headers_a = two_tenants_with_units["headers_a"]

    empty = real_client.get("/api/moderation", headers=headers_a)
    assert empty.status_code == 200, empty.text
    assert empty.json()["items"] == []

    created = real_client.post("/api/moderation", headers=headers_a, json=_entry_body())
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["work_unit_code"] == "WU-TEST-MOD-A"
    assert row["from_level"] == 3
    assert row["to_level"] == 4
    assert row["moderated_by"] == "QA Moderator"
    assert "six weeks" in row["reason"]

    # Survives a fresh read, not just the create response.
    listed = real_client.get("/api/moderation", headers=headers_a).json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == row["id"]


@pg_skip
def test_rls_moderation_isolation_via_http(real_client, two_tenants_with_units):
    headers_a = two_tenants_with_units["headers_a"]
    headers_b = two_tenants_with_units["headers_b"]

    real_client.post("/api/moderation", headers=headers_a, json=_entry_body())

    # B cannot even cite A's unit code -- it isn't B's Work Unit.
    cross = real_client.post("/api/moderation", headers=headers_b, json=_entry_body(work_unit_code="WU-TEST-MOD-A"))
    assert cross.status_code == 404, cross.text

    listed_b = real_client.get("/api/moderation", headers=headers_b).json()
    assert listed_b["items"] == []
