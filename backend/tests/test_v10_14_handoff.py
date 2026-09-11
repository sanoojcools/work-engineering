"""V10-14 (docs/contracts/v10-14-handoff.md): ?view=governor|performer on
GET /api/spec/handoff/{code}. Same real-Postgres fixture pattern as
test_handoff.py (TenantDbDep's `SET app.current_client_id` is Postgres-only
syntax SQLite can't execute) -- reuse rather than reinvent."""
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


_WORK_UNIT_CHILD_TABLES = ("verdict_scores", "cost_profiles", "verification_designs")


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
    session.execute(text("DELETE FROM moderation_entries WHERE client_id = ANY(:ids)"), ids)
    for table in _WORK_UNIT_CHILD_TABLES:
        session.execute(text(
            f"DELETE FROM {table} WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
        ), ids)
    session.execute(text(
        "DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) "
        "OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
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


def _make_work_unit(real_client, headers, cid, code, suffix, **overrides):
    et = real_client.post("/api/ontology/types", json={
        "name": f"test-v1014-object-{cid}-{suffix}", "kind": "business_object",
    })
    assert et.status_code == 201, et.text
    body = {
        "code": code,
        "name": "Test v10-14 unit",
        "business_object_type_id": et.json()["id"],
        "current_condition": "unchecked",
        "desired_condition": "checked",
        "owner": "Test Owner",
    }
    body.update(overrides)
    wu = real_client.post("/api/work-units/", headers=headers, json=body)
    assert wu.status_code == 201, wu.text
    return wu.json()


@pytest.fixture
def tenant(real_client):
    session = SetupSession()
    key, cid = _make_tenant(session, "v1014")
    session.commit()
    session.close()
    yield {"headers": {"X-Spec-Key": key}, "client_id": cid}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


_SCORE = {
    "verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3,
    "impact_scope": 4, "compliance": 5, "tacitness": 3,
}


def _ready_unit(real_client, tenant, code, suffix, **overrides):
    wu = _make_work_unit(real_client, tenant["headers"], tenant["client_id"], code, suffix, **overrides)
    scored = real_client.put(f"/api/verdict/{wu['id']}", headers=tenant["headers"], json=_SCORE)
    assert scored.status_code == 200, scored.text
    design = real_client.put(
        f"/api/work-units/{wu['id']}/verification-design", headers=tenant["headers"],
        json={"method": "system_of_record"},
    )
    assert design.status_code == 200, design.text
    return wu, scored.json()


# 1. 401 without key
def test_handoff_view_rejects_missing_key(client):
    assert client.get("/api/spec/handoff/WU-ANY?view=governor").status_code == 401


# 5. Unknown view -> 422
@pg_skip
def test_unknown_view_is_422(real_client, tenant):
    _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-1014-BADVIEW", "badview")
    resp = real_client.get("/api/spec/handoff/WU-TEST-1014-BADVIEW?view=nonsense", headers=tenant["headers"])
    assert resp.status_code == 422


# 3. Not-ready -> bundle null on both views
@pg_skip
def test_not_ready_bundle_null_on_both_views(real_client, tenant):
    _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-1014-NOTREADY", "notready")
    for view in ("governor", "performer"):
        resp = real_client.get(
            f"/api/spec/handoff/WU-TEST-1014-NOTREADY?view={view}", headers=tenant["headers"],
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["ready"] is False
        assert body["bundle"] is None


# 2. Default view is governor; performer withholds scenario ints (all null)
# and has no recommended_level on bundle.record.
@pg_skip
def test_default_view_is_governor_with_real_scenario_ints(real_client, tenant):
    wu, verdict = _ready_unit(real_client, tenant, "WU-TEST-1014-GOV", "gov")

    default_resp = real_client.get(f"/api/spec/handoff/{wu['code']}", headers=tenant["headers"])
    assert default_resp.status_code == 200, default_resp.text
    default_body = default_resp.json()
    assert default_body["ready"] is True

    gov_resp = real_client.get(f"/api/spec/handoff/{wu['code']}?view=governor", headers=tenant["headers"])
    gov_body = gov_resp.json()
    assert gov_body == default_body  # default view IS governor

    bundle = gov_body["bundle"]
    assert bundle is not None
    scenario = bundle["scenario"]
    assert scenario["careful"] is not None
    assert scenario["as_calculated"] == verdict["recommended_level"]
    assert scenario["ambitious"] is not None
    assert scenario["cap"] is not None
    assert scenario["careful"] <= scenario["as_calculated"] <= scenario["ambitious"] <= scenario["cap"]
    assert "recommended_level" not in bundle["record"]

    perf_resp = real_client.get(f"/api/spec/handoff/{wu['code']}?view=performer", headers=tenant["headers"])
    assert perf_resp.status_code == 200, perf_resp.text
    perf_bundle = perf_resp.json()["bundle"]
    assert perf_bundle is not None
    assert perf_bundle["scenario"] == {"careful": None, "as_calculated": None, "ambitious": None, "cap": None}
    assert "recommended_level" not in perf_bundle["record"]
    # actor_policy.cap is a limit, not a score -- it may stay on performer.
    assert perf_bundle["actor_policy"]["cap"] == verdict["allocation"]
    # gates are names, not points -- they may stay on performer too.
    assert perf_bundle["gates"] == bundle["gates"]


# 4. Dual-employment WU-OD-02 without stop language still not ready / unliftable
@pg_skip
def test_dual_employment_unit_stays_unready_on_both_views(real_client, tenant):
    wu = _make_work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "v1014dual",
        acceptance_criteria="All documents present", evidence_required="Zwayam event",
        current_condition="checked", sla_hours=4,
    )
    scored = real_client.put(f"/api/verdict/{wu['id']}", headers=tenant["headers"], json=_SCORE)
    assert scored.status_code == 200, scored.text

    for view in ("governor", "performer"):
        resp = real_client.get(f"/api/spec/handoff/WU-OD-02?view={view}", headers=tenant["headers"])
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["dual_employment_stop_required"] is True
        assert body["ready"] is False
        assert body["bundle"] is None


# 7. Existing handoff shape still readable via bundle.record after migration
@pg_skip
def test_bundle_record_carries_the_old_bundle_fields(real_client, tenant):
    wu, _ = _ready_unit(real_client, tenant, "WU-TEST-1014-RECORD", "record")
    resp = real_client.get(f"/api/spec/handoff/{wu['code']}", headers=tenant["headers"])
    record = resp.json()["bundle"]["record"]
    assert record["code"] == wu["code"]
    assert record["id"] == wu["id"]
