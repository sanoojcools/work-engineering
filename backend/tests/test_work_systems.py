"""CENSUS-v0 Part B: work_systems get-or-create + ratify. Real Postgres
only for the positive paths — TenantDbDep's `SET app.current_client_id`
is Postgres-specific syntax SQLite can't execute (same reason
test_rls_http.py / test_partial_ratify.py are real-Postgres-only); the
SQLite `client` fixture is fine for the missing-key 401 case since that
never reaches tenant_db()."""
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
    key_a, cid_a = _make_tenant(session, "ws-a")
    key_b, cid_b = _make_tenant(session, "ws-b")
    session.commit()
    session.close()

    yield {
        "key_a": key_a, "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a},
        "key_b": key_b, "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b},
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


def _ensure_body(**overrides) -> dict:
    body = {
        "code": "WS-OFFER-ONBOARD",
        "name": "Recruiter asks for offer -> offer released -> Day-1 ready",
        "entry": "Recruiter sends offer request",
        "exit": "New hire fully onboarded",
        "owner": "Head of HR operations (stand-in)",
        "outcome": "Candidate handed over, Day-1 ready",
        "function_intent_outcome": "Safe offer, two-hour SLA",
        "function_intent_owner": "Head of HR operations (stand-in)",
        "function_intent_measure": "SLA: 2 hours from recruiter request to offer letter release",
        "work_system_intent_purpose": "If Offer Desk stalls, candidates walk to other offers over two weeks.",
        "work_system_intent_owner": "Head of HR operations (stand-in)",
    }
    body.update(overrides)
    return body


def test_work_systems_rejects_missing_key(client):
    assert client.get("/api/work-systems").status_code == 401
    assert client.post("/api/work-systems", json=_ensure_body()).status_code == 401


@pg_skip
def test_ensure_creates_candidate_row(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]

    empty = real_client.get("/api/work-systems", headers=headers_a)
    assert empty.status_code == 200, empty.text
    assert empty.json()["items"] == []

    created = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body())
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["code"] == "WS-OFFER-ONBOARD"
    assert row["status"] == "candidate"
    assert row["ratified_by"] == ""
    assert row["ratified_at"] is None

    # D -- INTENT-LITE: both intents drafted from the ensure call, neither
    # confirmed yet -- draft must not look governed.
    assert row["function_intent"]["label"] == "Safe offer, two-hour SLA"
    assert row["function_intent"]["owner"] == "Head of HR operations (stand-in)"
    assert row["function_intent"]["measure"] == "SLA: 2 hours from recruiter request to offer letter release"
    assert row["function_intent"]["status"] == "draft"
    assert row["function_intent"]["confirmed_by"] == ""
    assert row["function_intent"]["confirmed_at"] is None
    assert row["work_system_intent"]["label"].startswith("If Offer Desk stalls")
    assert row["work_system_intent"]["status"] == "draft"
    assert row["work_system_intent"]["measure"] is None

    listed = real_client.get("/api/work-systems", headers=headers_a)
    assert listed.json()["total"] == 1


@pg_skip
def test_ensure_is_idempotent_and_never_overwrites_existing_row(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    first = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()

    # A second ensure call with different field values must return the
    # SAME row unchanged, not overwrite it -- otherwise a later guest-shaped
    # default could silently clobber a tenant's already-ratified record.
    second = real_client.post(
        "/api/work-systems", headers=headers_a,
        json=_ensure_body(name="a different name entirely", function_intent_outcome="a different outcome entirely"),
    )
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first["id"]
    assert second.json()["name"] == first["name"]
    assert second.json()["function_intent"]["label"] == first["function_intent"]["label"]

    listed = real_client.get("/api/work-systems", headers=headers_a).json()
    assert listed["total"] == 1


@pg_skip
def test_ratify_sets_status_name_and_timestamp(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_id = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()["id"]

    ratified = real_client.post(
        f"/api/work-systems/{ws_id}/ratify", headers=headers_a, json={"ratified_by": "Sanooj (HR ops)"},
    )
    assert ratified.status_code == 200, ratified.text
    row = ratified.json()
    assert row["status"] == "ratified"
    assert row["ratified_by"] == "Sanooj (HR ops)"
    assert row["ratified_at"] is not None

    # Survives a fresh read, not just the response of the ratify call itself.
    reread = real_client.get("/api/work-systems", headers=headers_a).json()["items"][0]
    assert reread["status"] == "ratified"
    assert reread["ratified_by"] == "Sanooj (HR ops)"


@pg_skip
def test_ratify_twice_is_rejected(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_id = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()["id"]
    first = real_client.post(f"/api/work-systems/{ws_id}/ratify", headers=headers_a, json={"ratified_by": "A"})
    assert first.status_code == 200, first.text

    again = real_client.post(f"/api/work-systems/{ws_id}/ratify", headers=headers_a, json={"ratified_by": "B"})
    assert again.status_code == 409, again.text


@pg_skip
def test_ratify_requires_a_name(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_id = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()["id"]

    empty_name = real_client.post(f"/api/work-systems/{ws_id}/ratify", headers=headers_a, json={"ratified_by": ""})
    assert empty_name.status_code == 422, empty_name.text


@pg_skip
def test_rls_work_systems_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]

    ws_a = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()

    # B's own ensure call creates ITS OWN row for the same code, not a
    # cross-tenant collision on the (client_id, code) unique constraint.
    ws_b = real_client.post("/api/work-systems", headers=headers_b, json=_ensure_body()).json()
    assert ws_b["id"] != ws_a["id"]

    # B never sees A's row in its own list.
    listed_b = real_client.get("/api/work-systems", headers=headers_b).json()["items"]
    assert all(row["id"] != ws_a["id"] for row in listed_b)

    # B cannot ratify A's row by id -- 404, not a cross-tenant write.
    cross_ratify = real_client.post(
        f"/api/work-systems/{ws_a['id']}/ratify", headers=headers_b, json={"ratified_by": "intruder"},
    )
    assert cross_ratify.status_code == 404, cross_ratify.text

    # A's row is unaffected by B's attempt.
    still_candidate = real_client.get("/api/work-systems", headers=headers_a).json()["items"][0]
    assert still_candidate["status"] == "candidate"


@pg_skip
def test_confirm_function_intent_sets_owner_and_timestamp(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_id = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()["id"]

    confirmed = real_client.post(
        f"/api/work-systems/{ws_id}/confirm-function-intent", headers=headers_a,
        json={"confirmed_by": "Sanooj (HR ops)"},
    )
    assert confirmed.status_code == 200, confirmed.text
    intent = confirmed.json()["function_intent"]
    assert intent["status"] == "confirmed"
    assert intent["confirmed_by"] == "Sanooj (HR ops)"
    assert intent["confirmed_at"] is not None
    # The other intent is untouched by confirming this one.
    assert confirmed.json()["work_system_intent"]["status"] == "draft"

    reread = real_client.get("/api/work-systems", headers=headers_a).json()["items"][0]
    assert reread["function_intent"]["status"] == "confirmed"
    assert reread["function_intent"]["confirmed_by"] == "Sanooj (HR ops)"


@pg_skip
def test_confirm_work_system_intent_sets_owner_and_timestamp(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_id = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()["id"]

    confirmed = real_client.post(
        f"/api/work-systems/{ws_id}/confirm-work-system-intent", headers=headers_a,
        json={"confirmed_by": "Sanooj (HR ops)"},
    )
    assert confirmed.status_code == 200, confirmed.text
    intent = confirmed.json()["work_system_intent"]
    assert intent["status"] == "confirmed"
    assert intent["confirmed_by"] == "Sanooj (HR ops)"
    assert intent["confirmed_at"] is not None
    assert confirmed.json()["function_intent"]["status"] == "draft"


@pg_skip
def test_confirm_function_intent_twice_is_rejected(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_id = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()["id"]

    first = real_client.post(
        f"/api/work-systems/{ws_id}/confirm-function-intent", headers=headers_a, json={"confirmed_by": "A"},
    )
    assert first.status_code == 200, first.text

    again = real_client.post(
        f"/api/work-systems/{ws_id}/confirm-function-intent", headers=headers_a, json={"confirmed_by": "B"},
    )
    assert again.status_code == 409, again.text


@pg_skip
def test_confirm_intent_requires_a_name(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    ws_id = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()["id"]

    empty_function = real_client.post(
        f"/api/work-systems/{ws_id}/confirm-function-intent", headers=headers_a, json={"confirmed_by": ""},
    )
    assert empty_function.status_code == 422, empty_function.text

    empty_ws = real_client.post(
        f"/api/work-systems/{ws_id}/confirm-work-system-intent", headers=headers_a, json={"confirmed_by": ""},
    )
    assert empty_ws.status_code == 422, empty_ws.text


@pg_skip
def test_confirm_intent_cross_tenant_is_404(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    ws_a = real_client.post("/api/work-systems", headers=headers_a, json=_ensure_body()).json()

    cross = real_client.post(
        f"/api/work-systems/{ws_a['id']}/confirm-function-intent", headers=headers_b,
        json={"confirmed_by": "intruder"},
    )
    assert cross.status_code == 404, cross.text
