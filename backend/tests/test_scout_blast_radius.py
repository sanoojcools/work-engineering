"""Scout Elevated upgrade thread, Point 2: CHRO Full Stack Blast Radius.
Real Postgres only, same reason as every other tenant-scoped test in this
repo -- see test_scout_sessions.py's module docstring. _make_tenant/pg_skip/
cleanup follow the same pattern, with scout_blast_radius_selections added
to the cleanup list.
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
    raw_key = f"test-{slug}-key-" + "b" * 20
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
    session.execute(text("DELETE FROM scout_blast_radius_selections WHERE client_id = ANY(:ids)"), ids)
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
    key_a, cid_a = _make_tenant(session, "blast-a")
    key_b, cid_b = _make_tenant(session, "blast-b")
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
def test_catalog_shape_and_defaults(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    got = real_client.get("/api/scout/blast-radius", headers=headers_a)
    assert got.status_code == 200, got.text
    body = got.json()
    assert len(body["items"]) == 44
    assert len({i["cluster"] for i in body["items"]}) == 6
    assert all(not i["in_scope"] and i["owner_name"] == "" and i["priority"] == "" for i in body["items"])
    assert body["summary"] == {
        "total_sub_functions": 44, "selected_count": 0, "selected_pct": 0.0,
        "total_clusters": 6, "clusters_touched": 0,
    }


@pg_skip
def test_select_sub_function_updates_summary(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    onboarding = next(
        i["key"] for i in real_client.get("/api/scout/blast-radius", headers=headers_a).json()["items"]
        if i["name"] == "Onboarding"
    )
    updated = real_client.patch(
        f"/api/scout/blast-radius/{onboarding}", headers=headers_a,
        json={"in_scope": True, "owner_name": "Head of People Ops", "priority": "P0"},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    row = next(i for i in body["items"] if i["key"] == onboarding)
    assert row == {
        "key": onboarding, "name": "Onboarding", "cluster": "People Operations / Core HR",
        "in_scope": True, "owner_name": "Head of People Ops", "priority": "P0",
    }
    assert body["summary"]["selected_count"] == 1
    assert body["summary"]["selected_pct"] == round(1 / 44 * 100, 1)
    assert body["summary"]["clusters_touched"] == 1

    # Refetching (a fresh GET) reflects the same persisted state.
    refetched = real_client.get("/api/scout/blast-radius", headers=headers_a).json()
    assert next(i for i in refetched["items"] if i["key"] == onboarding)["in_scope"] is True


@pg_skip
def test_partial_update_leaves_other_fields_unset(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    payroll = next(
        i["key"] for i in real_client.get("/api/scout/blast-radius", headers=headers_a).json()["items"]
        if i["name"] == "Payroll"
    )
    real_client.patch(f"/api/scout/blast-radius/{payroll}", headers=headers_a, json={"in_scope": True})
    second = real_client.patch(
        f"/api/scout/blast-radius/{payroll}", headers=headers_a, json={"owner_name": "Priya N."}
    )
    row = next(i for i in second.json()["items"] if i["key"] == payroll)
    assert row["in_scope"] is True
    assert row["owner_name"] == "Priya N."


@pg_skip
def test_unknown_sub_function_404(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    resp = real_client.patch(
        "/api/scout/blast-radius/not-a-real-subfunction", headers=headers_a, json={"in_scope": True}
    )
    assert resp.status_code == 404, resp.text


@pg_skip
def test_invalid_priority_rejected(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    key = real_client.get("/api/scout/blast-radius", headers=headers_a).json()["items"][0]["key"]
    resp = real_client.patch(f"/api/scout/blast-radius/{key}", headers=headers_a, json={"priority": "P5"})
    assert resp.status_code == 422, resp.text


@pg_skip
def test_selections_isolated_across_tenants(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    key = real_client.get("/api/scout/blast-radius", headers=headers_a).json()["items"][0]["key"]
    real_client.patch(f"/api/scout/blast-radius/{key}", headers=headers_a, json={"in_scope": True})

    b_view = real_client.get("/api/scout/blast-radius", headers=headers_b).json()
    row_b = next(i for i in b_view["items"] if i["key"] == key)
    assert row_b["in_scope"] is False
    assert b_view["summary"]["selected_count"] == 0
