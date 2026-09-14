"""MANDATE-4 (docs/contracts/mandate-4-shadow.md): shadow_logs -- in-app
self-reported finish times for one piece of work. Real Postgres only for
the positive paths -- TenantDbDep's `SET app.current_client_id` is
Postgres-specific syntax SQLite can't execute (same reason
test_field_ratifications.py / test_work_systems.py are real-Postgres-only);
the SQLite `client` fixture is fine for the missing-key 401 case since that
never reaches tenant_db()."""
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


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
    session.execute(text("DELETE FROM shadow_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM verdict_scores WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM verification_designs WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
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


@pytest.fixture
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "sl-a")
    key_b, cid_b = _make_tenant(session, "sl-b")
    session.commit()
    session.close()

    yield {
        "key_a": key_a, "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a},
        "key_b": key_b, "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b},
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


@pytest.fixture
def tenant(real_client):
    session = SetupSession()
    key, cid = _make_tenant(session, "sl-solo")
    session.commit()
    session.close()
    yield {"headers": {"X-Spec-Key": key}, "client_id": cid}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


def _work_unit(real_client, headers, cid, code, suffix, **overrides) -> dict:
    # entity_types.name is globally unique, not per-tenant -- suffix keeps
    # a fresh name every test run against a warm, already-exercised database.
    et = real_client.post("/api/ontology/types", json={
        "name": f"test-shadow-object-{cid}-{suffix}", "kind": "business_object",
    })
    assert et.status_code == 201, et.text
    body = {
        "code": code,
        "name": "Test shadow unit",
        "business_object_type_id": et.json()["id"],
        "current_condition": "unchecked",
        "desired_condition": "checked",
    }
    body.update(overrides)
    wu = real_client.post("/api/work-units/", headers=headers, json=body)
    assert wu.status_code == 201, wu.text
    return wu.json()


def _occurred_at(offset_minutes: int = 0) -> str:
    return (datetime(2026, 9, 1, tzinfo=timezone.utc) + timedelta(minutes=offset_minutes)).isoformat()


def test_shadow_logs_rejects_missing_key(client):
    assert client.get("/api/work-units/1/shadow-logs").status_code == 401
    assert client.post(
        "/api/work-units/1/shadow-logs", json={"occurred_at": _occurred_at()},
    ).status_code == 401
    assert client.get("/api/work-units/1/shadow-summary").status_code == 401


@pg_skip
def test_empty_get_returns_empty_list(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-01", "a")
    resp = real_client.get(f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


@pg_skip
def test_post_creates_a_row(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-02", "b")
    resp = real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(), "duration_minutes": 45, "note": "finished the draft"},
    )
    assert resp.status_code == 201, resp.text
    row = resp.json()
    assert row["work_unit_id"] == wu["id"]
    assert row["duration_minutes"] == 45
    assert row["note"] == "finished the draft"

    listed = real_client.get(f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"])
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 1


@pg_skip
def test_duration_minutes_out_of_range_is_422(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-03", "c")
    too_low = real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(), "duration_minutes": 0},
    )
    assert too_low.status_code == 422, too_low.text

    too_high = real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(1), "duration_minutes": 481},
    )
    assert too_high.status_code == 422, too_high.text

    # No duration at all is fine -- null, not a guess.
    no_duration = real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(2)},
    )
    assert no_duration.status_code == 201, no_duration.text
    assert no_duration.json()["duration_minutes"] is None


@pg_skip
def test_sixth_row_for_a_unit_is_rejected(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-04", "d")
    for i in range(5):
        resp = real_client.post(
            f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
            json={"occurred_at": _occurred_at(i), "duration_minutes": 30},
        )
        assert resp.status_code == 201, resp.text

    sixth = real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(5), "duration_minutes": 30},
    )
    assert sixth.status_code == 422, sixth.text

    listed = real_client.get(f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"])
    assert len(listed.json()) == 5


@pg_skip
def test_summary_label_and_confidence(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-05", "e")
    real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(), "duration_minutes": 20},
    )
    summary = real_client.get(f"/api/work-units/{wu['id']}/shadow-summary", headers=tenant["headers"])
    assert summary.status_code == 200, summary.text
    body = summary.json()
    assert body["label"] == "self_reported"
    assert body["confidence"] == "low"
    assert body["count"] == 1
    assert len(body["last_five"]) == 1

    # Hard invariant: summary JSON must never carry stated/defended/61.8 keys.
    assert "stated" not in body
    assert "defended" not in body
    assert "61.8" not in body


@pg_skip
def test_summary_empty_when_no_rows(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-06", "f")
    summary = real_client.get(f"/api/work-units/{wu['id']}/shadow-summary", headers=tenant["headers"])
    assert summary.status_code == 200, summary.text
    body = summary.json()
    assert body["count"] == 0
    assert body["last_five"] == []
    assert body["duration_minutes_sum"] is None


@pg_skip
def test_duration_sum_null_if_a_row_has_no_duration(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-07", "g")
    real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(0), "duration_minutes": 30},
    )
    real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at(1)},  # no duration
    )
    summary = real_client.get(f"/api/work-units/{wu['id']}/shadow-summary", headers=tenant["headers"])
    assert summary.status_code == 200, summary.text
    assert summary.json()["duration_minutes_sum"] is None


@pg_skip
def test_duration_sum_when_all_rows_have_duration(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-08", "h")
    for i, minutes in enumerate((10, 20, 30)):
        resp = real_client.post(
            f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
            json={"occurred_at": _occurred_at(i), "duration_minutes": minutes},
        )
        assert resp.status_code == 201, resp.text

    summary = real_client.get(f"/api/work-units/{wu['id']}/shadow-summary", headers=tenant["headers"])
    assert summary.status_code == 200, summary.text
    assert summary.json()["duration_minutes_sum"] == 60


@pg_skip
def test_duplicate_occurred_at_is_rejected(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-09", "i")
    same_time = _occurred_at()
    first = real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": same_time, "duration_minutes": 15},
    )
    assert first.status_code == 201, first.text

    dupe = real_client.post(
        f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": same_time, "duration_minutes": 15},
    )
    assert dupe.status_code == 409, dupe.text


@pg_skip
def test_rls_shadow_logs_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]

    wu_a = _work_unit(real_client, headers_a, two_tenants["client_a_id"], "WU-SHADOW-RLS-A", "j")

    created = real_client.post(
        f"/api/work-units/{wu_a['id']}/shadow-logs", headers=headers_a,
        json={"occurred_at": _occurred_at(), "duration_minutes": 25},
    )
    assert created.status_code == 201, created.text

    # B cannot see A's unit at all, RLS-scoped -- 404, not an empty list.
    cross_get = real_client.get(f"/api/work-units/{wu_a['id']}/shadow-logs", headers=headers_b)
    assert cross_get.status_code == 404, cross_get.text

    cross_post = real_client.post(
        f"/api/work-units/{wu_a['id']}/shadow-logs", headers=headers_b,
        json={"occurred_at": _occurred_at(1), "duration_minutes": 10},
    )
    assert cross_post.status_code == 404, cross_post.text

    cross_summary = real_client.get(f"/api/work-units/{wu_a['id']}/shadow-summary", headers=headers_b)
    assert cross_summary.status_code == 404, cross_summary.text

    # A still sees its own single row.
    still_a = real_client.get(f"/api/work-units/{wu_a['id']}/shadow-logs", headers=headers_a)
    assert len(still_a.json()) == 1


@pg_skip
def test_hours_95_61_8_unchanged_after_posts(real_client, tenant):
    wu = _work_unit(real_client, tenant["headers"], tenant["client_id"], "WU-SHADOW-10", "k")

    before = real_client.get("/api/simulations/offer-day1", headers=tenant["headers"])
    assert before.status_code == 200, before.text
    assert before.json()["capacity"]["stated_hours_mo"] == 95.0
    assert before.json()["capacity"]["defended_hours_mo"] == 61.8

    for i in range(5):
        resp = real_client.post(
            f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
            json={"occurred_at": _occurred_at(i), "duration_minutes": 60},
        )
        assert resp.status_code == 201, resp.text

    after = real_client.get("/api/simulations/offer-day1", headers=tenant["headers"])
    assert after.status_code == 200, after.text
    assert after.json()["capacity"]["stated_hours_mo"] == 95.0
    assert after.json()["capacity"]["defended_hours_mo"] == 61.8


@pg_skip
def test_dual_employment_stop_still_unliftable_after_shadow_logs(real_client, tenant):
    # WU-OD-02 is the one code services/handoff.py's DUAL_EMPLOYMENT_STOP_CODES
    # actually checks -- created here WITHOUT the sheet's own dual-employment
    # language, same setup test_handoff.py's own dual-employment test uses.
    wu = _work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "l",
        acceptance_criteria="All documents present", evidence_required="Zwayam event",
        current_condition="checked", sla_hours=4,
    )
    scored = real_client.put(
        f"/api/verdict/{wu['id']}", headers=tenant["headers"],
        json={"verifiability": 4, "evidence": 4, "reversibility": 4, "determinism": 3, "impact_scope": 4, "compliance": 5, "tacitness": 3},
    )
    assert scored.status_code == 200, scored.text

    before = real_client.get(f"/api/spec/handoff/{wu['code']}", headers=tenant["headers"])
    assert before.status_code == 200, before.text
    assert before.json()["dual_employment_stop_required"] is True
    assert before.json()["ready"] is False

    # Logging finish times on this piece must never lift the stop.
    for i in range(5):
        resp = real_client.post(
            f"/api/work-units/{wu['id']}/shadow-logs", headers=tenant["headers"],
            json={"occurred_at": _occurred_at(i), "duration_minutes": 30, "note": "done"},
        )
        assert resp.status_code == 201, resp.text

    after = real_client.get(f"/api/spec/handoff/{wu['code']}", headers=tenant["headers"])
    assert after.status_code == 200, after.text
    assert after.json()["dual_employment_stop_required"] is True
    assert after.json()["ready"] is False
    assert after.json()["bundle"] is None
    assert any("dual-employment stop" in r.lower() for r in after.json()["reasons"])


@pg_skip
def test_get_or_post_on_missing_work_unit_is_404(real_client, tenant):
    missing = real_client.get("/api/work-units/999999999/shadow-logs", headers=tenant["headers"])
    assert missing.status_code == 404, missing.text

    missing_post = real_client.post(
        "/api/work-units/999999999/shadow-logs", headers=tenant["headers"],
        json={"occurred_at": _occurred_at()},
    )
    assert missing_post.status_code == 404, missing_post.text
