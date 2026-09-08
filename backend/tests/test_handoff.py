"""P2 -- Handoff completeness (docs/BUILD_PROGRAM.md CENSUS-PACK). Real
Postgres only for the positive paths -- same reasoning test_moderation.py's
own docstring gives (TenantDbDep's `SET app.current_client_id` is
Postgres-only syntax SQLite can't execute).
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


_WORK_UNIT_CHILD_TABLES = ("verdict_scores", "cost_profiles", "verification_designs")


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
    # V10-3 tests below log a moderation entry and/or run POST /census/run,
    # which (like V10-3's own verification-design writes) leaves rows this
    # older cleanup never had to clear.
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
    # entity_types.name is globally unique, not per-tenant -- suffix keeps
    # a fresh name every test run against a warm, already-exercised database.
    et = real_client.post("/api/ontology/types", json={
        "name": f"test-handoff-object-{cid}-{suffix}", "kind": "business_object",
    })
    assert et.status_code == 201, et.text
    body = {
        "code": code,
        "name": "Test handoff unit",
        "business_object_type_id": et.json()["id"],
        "current_condition": "unchecked",
        "desired_condition": "checked",
    }
    body.update(overrides)
    wu = real_client.post("/api/work-units/", headers=headers, json=body)
    assert wu.status_code == 201, wu.text
    return wu.json()


@pytest.fixture
def tenant(real_client):
    session = SetupSession()
    key, cid = _make_tenant(session, "handoff")
    session.commit()
    session.close()
    yield {"headers": {"X-Spec-Key": key}, "client_id": cid}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


def test_handoff_rejects_missing_key(client):
    assert client.get("/api/spec/handoff/WU-ANY").status_code == 401


@pg_skip
def test_not_ready_when_no_record_exists(real_client, tenant):
    resp = real_client.get("/api/spec/handoff/WU-DOES-NOT-EXIST", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is False
    assert body["bundle"] is None
    assert "no record" in body["reasons"][0].lower()


@pg_skip
def test_not_ready_when_record_exists_but_never_scored(real_client, tenant):
    _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-A", "a")
    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-A", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is False
    assert body["gates"] is None
    assert body["bundle"] is None
    assert any("verdict" in r.lower() for r in body["reasons"])


@pg_skip
def test_ready_once_scored_with_no_dual_employment_requirement(real_client, tenant):
    wu = _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-B", "b")
    scored = real_client.put(
        f"/api/verdict/{wu['id']}",
        headers=tenant["headers"],
        json={"verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3, "impact_scope": 4, "compliance": 5, "tacitness": 3},
    )
    assert scored.status_code == 200, scored.text

    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-B", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is True, body["reasons"]
    assert body["reasons"] == []
    assert isinstance(body["gates"], list)
    assert body["dual_employment_stop_required"] is False
    assert body["bundle"] is not None
    assert body["bundle"]["code"] == "WU-TEST-HANDOFF-B"


@pg_skip
def test_dual_employment_unit_not_ready_without_the_stop_stated(real_client, tenant):
    # WU-OD-02 is the one code this rule actually checks -- created here
    # WITHOUT the sheet's own dual-employment language, so a real (scored)
    # record can still be honestly refused.
    wu = _make_work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "c",
        acceptance_criteria="All documents present", evidence_required="Zwayam event",
    )
    scored = real_client.put(
        f"/api/verdict/{wu['id']}",
        headers=tenant["headers"],
        json={"verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3, "impact_scope": 4, "compliance": 5, "tacitness": 3},
    )
    assert scored.status_code == 200, scored.text

    resp = real_client.get("/api/spec/handoff/WU-OD-02", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["dual_employment_stop_required"] is True
    assert body["ready"] is False
    assert body["bundle"] is None
    assert any("dual-employment stop" in r.lower() for r in body["reasons"])


@pg_skip
def test_dual_employment_unit_ready_once_the_stop_is_stated_and_scored(real_client, tenant):
    wu = _make_work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "d",
        failure_semantics="If dual employment detected in UAN: do NOT release offer -- deviation approval required.",
    )
    scored = real_client.put(
        f"/api/verdict/{wu['id']}",
        headers=tenant["headers"],
        json={"verifiability": 3, "evidence": 4, "reversibility": 3, "determinism": 2, "impact_scope": 4, "compliance": 5, "tacitness": 3},
    )
    assert scored.status_code == 200, scored.text

    resp = real_client.get("/api/spec/handoff/WU-OD-02", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["dual_employment_stop_required"] is True
    assert body["ready"] is True, body["reasons"]
    assert body["bundle"] is not None


@pg_skip
def test_rls_handoff_isolation_via_http(real_client, tenant):
    session = SetupSession()
    key_b, cid_b = _make_tenant(session, "handoff-b")
    session.commit()
    session.close()
    headers_b = {"X-Spec-Key": key_b}

    _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-RLS", "rls")

    # Tenant B cannot see tenant A's record -- reads as "no record", not a
    # cross-tenant leak of A's readiness.
    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-RLS", headers=headers_b)
    assert resp.status_code == 200, resp.text
    assert resp.json()["ready"] is False
    assert "no record" in resp.json()["reasons"][0].lower()

    session = SetupSession()
    _cleanup(session, [cid_b])
    session.close()


# --- V10-3: 5th gate (independent check) + dual-employment-stop-under-moderation ---

_SCORE = {
    "verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3,
    "impact_scope": 4, "compliance": 5, "tacitness": 3,
}


@pg_skip
def test_offer_release_not_ready_without_independent_check(real_client, tenant):
    """V10-3's 5th gate (docs/BUILD_PROGRAM.md): 'Handoff Not ready if
    independence required and missing.' A human explicitly required an
    independent check on this unit's verification design; none is recorded."""
    wu = _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-IND", "ind")
    scored = real_client.put(f"/api/verdict/{wu['id']}", headers=tenant["headers"], json=_SCORE)
    assert scored.status_code == 200, scored.text

    design = real_client.put(
        f"/api/work-units/{wu['id']}/verification-design", headers=tenant["headers"],
        json={"independence_required": True},
    )
    assert design.status_code == 200, design.text
    assert design.json()["independence"] == "no"

    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-IND", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is False
    assert body["independent_check_required"] is True
    assert "gate5_independent_check" in (body["gates"] or [])
    assert any("independent check required and missing" in r.lower() for r in body["reasons"])
    assert body["bundle"] is None


@pg_skip
def test_offer_release_ready_once_independent_check_recorded(real_client, tenant):
    wu = _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-TEST-HANDOFF-IND-OK", "indok")
    scored = real_client.put(f"/api/verdict/{wu['id']}", headers=tenant["headers"], json=_SCORE)
    assert scored.status_code == 200, scored.text

    design = real_client.put(
        f"/api/work-units/{wu['id']}/verification-design", headers=tenant["headers"],
        json={"independence_required": True, "independence": "different_lineage"},
    )
    assert design.status_code == 200, design.text

    resp = real_client.get("/api/spec/handoff/WU-TEST-HANDOFF-IND-OK", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is True, body["reasons"]
    assert body["independent_check_required"] is True
    assert body["bundle"] is not None


@pg_skip
def test_offer_release_not_ready_when_verdict_intent_is_unconfirmed(real_client, tenant):
    """The other half of the 5th gate: non-waivable, from VERDICT's own
    origin -- no explicit independence_required flag needed. POST
    /census/run (services/census.py::run_census) is the real production
    path that drafts a VerdictScore with origin="inferred" for a unit
    nobody has confirmed; that alone must be enough to refuse handoff."""
    _make_work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-HR-GATE5-01", "g5")

    run = real_client.post("/api/census/run", headers=tenant["headers"], json={
        "client_id": tenant["client_id"], "function": "HR & People Ops",
    })
    assert run.status_code == 200, run.text
    assert run.json()["verdict_drafted"] >= 1

    resp = real_client.get("/api/spec/handoff/WU-HR-GATE5-01", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ready"] is False
    assert body["independent_check_required"] is True
    assert "gate5_independent_check" in (body["gates"] or [])
    assert any("not yet confirmed" in r.lower() for r in body["reasons"])


@pg_skip
def test_moderation_toward_ambitious_does_not_lift_dual_employment_stop(real_client, tenant):
    """Dual-employment stop never lifts: a logged request to moderate this
    unit's scenario allocation all the way to the most ambitious level
    (S3, L6) is an opinion (models/moderation.py), never a write to
    verdict_scores/work_units -- handoff must stay exactly as refused as it
    was before the moderation entry existed."""
    wu = _make_work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "modstop",
        acceptance_criteria="All documents present", evidence_required="Zwayam event",
    )
    scored = real_client.put(f"/api/verdict/{wu['id']}", headers=tenant["headers"], json=_SCORE)
    assert scored.status_code == 200, scored.text

    before = real_client.get("/api/spec/handoff/WU-OD-02", headers=tenant["headers"]).json()
    assert before["ready"] is False

    mod = real_client.post("/api/moderation", headers=tenant["headers"], json={
        "work_unit_code": "WU-OD-02",
        "from_level": scored.json()["recommended_level"],
        "to_level": 6,
        "reason": "Ambitious case: assume this scales without friction.",
        "moderated_by": "Test Ops Lead",
    })
    assert mod.status_code == 201, mod.text

    after = real_client.get("/api/spec/handoff/WU-OD-02", headers=tenant["headers"])
    assert after.status_code == 200, after.text
    body = after.json()
    assert body["dual_employment_stop_required"] is True
    assert body["ready"] is False
    assert body["bundle"] is None
    assert any("dual-employment stop" in r.lower() for r in body["reasons"])
