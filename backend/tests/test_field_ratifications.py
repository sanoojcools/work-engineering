"""V10-8 (docs/contracts/v10-8-field-ratify.md): field ratify + decision
cards. Real Postgres only for the positive paths -- TenantDbDep's
`SET app.current_client_id` is Postgres-specific syntax SQLite can't
execute (same reason test_pointers.py / test_work_systems.py are
real-Postgres-only); the SQLite `client` fixture is fine for the
missing-key 401 case since that never reaches tenant_db()."""
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
    session.execute(text("DELETE FROM field_ratifications WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM field_pointers WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM verification_designs WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM verdict_scores WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM work_unit_provenance WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("UPDATE work_units SET genome_version_id = NULL WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM uploaded_files WHERE client_id = ANY(:ids)"), ids)
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
    key_a, cid_a = _make_tenant(session, "fr-a")
    key_b, cid_b = _make_tenant(session, "fr-b")
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
        "name": "V10-8 Field Ratify Test Object", "kind": "business_object", "state_machine": '["draft","done"]',
    })
    if r.status_code == 409:
        existing = real_client.get("/api/ontology/types").json()["items"]
        return next(t["id"] for t in existing if t["name"] == "V10-8 Field Ratify Test Object")
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _work_unit(real_client, headers, type_id, code="WU-FR-01", **overrides) -> int:
    body = {
        "code": code, "name": "Approve thing", "business_object_type_id": type_id,
        "current_condition": "draft", "desired_condition": "approved",
        "context": "", "trigger": "request arrives", "inputs": "form",
        "authority": "", "actor_constraints": "", "acceptance_criteria": "",
        "evidence_required": "", "verification_method": "deterministic_rule",
        "sla_hours": 4, "failure_semantics": "hold and notify", "owner": "Ops",
    }
    body.update(overrides)
    r = real_client.post("/api/work-units/", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _upload(real_client, headers, content: bytes, name: str) -> int:
    r = real_client.post("/api/files/upload", headers=headers, files={"file": (name, content, "application/octet-stream")})
    assert r.status_code == 201, r.text
    return int(r.json()["file_id"])


def test_field_ratifications_rejects_missing_key(client):
    assert client.get("/api/work-units/1/field-ratifications").status_code == 401
    assert client.post(
        "/api/work-units/1/field-ratifications",
        json={"field_name": "authority", "sitting_quote": "the SME said so", "drafted_value": "Ops Lead"},
    ).status_code == 401
    assert client.get("/api/work-units/1/decision-cards").status_code == 401


@pg_skip
def test_no_key_401(real_client, two_tenants):
    for headers in ({}, {"X-Spec-Key": "not-a-real-key"}):
        assert real_client.get("/api/work-units/1/field-ratifications", headers=headers).status_code == 401
        assert real_client.post(
            "/api/work-units/1/field-ratifications", headers=headers,
            json={"field_name": "authority", "sitting_quote": "the SME said so", "drafted_value": "Ops Lead"},
        ).status_code == 401
        assert real_client.get("/api/work-units/1/decision-cards", headers=headers).status_code == 401


@pg_skip
def test_post_draft_is_idempotent_per_unit_field(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-FR-IDEM")

    first = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "the SME said Ops Lead signs off", "drafted_value": "Ops Lead",
    })
    assert first.status_code == 200, first.text
    body1 = first.json()
    assert body1["status"] == "drafted"

    second = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "a totally different later quote here",
        "drafted_value": "Someone Else",
    })
    assert second.status_code == 200, second.text
    body2 = second.json()
    # Same row, unchanged -- a later caller's quote/value never overwrites a standing draft.
    assert body2["id"] == body1["id"]
    assert body2["sitting_quote"] == body1["sitting_quote"]
    assert body2["drafted_value"] == body1["drafted_value"]

    listed = real_client.get(f"/api/work-units/{wu_id}/field-ratifications", headers=headers).json()
    assert listed["total"] == 1


@pg_skip
@pytest.mark.parametrize("field_name,drafted", [
    ("authority", "Ops Lead"),
    ("acceptance_criteria", "Two approvals recorded"),
    ("desired_condition", "approved and released"),
])
def test_confirm_writes_the_work_unit_field(real_client, two_tenants, field_name, drafted):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code=f"WU-FR-CONF-{field_name}")

    draft = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": field_name, "sitting_quote": "the person on the sitting said exactly this",
        "drafted_value": drafted,
    }).json()

    confirmed = real_client.post(
        f"/api/work-units/{wu_id}/field-ratifications/{draft['id']}/confirm", headers=headers,
        json={"action": "confirm", "confirmed_by": "Sanooj (HR ops)"},
    )
    assert confirmed.status_code == 200, confirmed.text
    body = confirmed.json()
    assert body["status"] == "confirmed"
    assert body["confirmed_value"] == drafted
    assert body["confirmed_by"] == "Sanooj (HR ops)"
    assert body["confirmed_at"] is not None

    wu = real_client.get(f"/api/work-units/{wu_id}", headers=headers).json()
    assert wu[field_name] == drafted


@pg_skip
def test_correct_writes_a_different_value_equal_is_422(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-FR-CORRECT")

    draft = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "the sitting quote about authority right here",
        "drafted_value": "Ops Lead",
    }).json()

    equal = real_client.post(
        f"/api/work-units/{wu_id}/field-ratifications/{draft['id']}/confirm", headers=headers,
        json={"action": "correct", "confirmed_by": "Sanooj", "value": "Ops Lead"},
    )
    assert equal.status_code == 422, equal.text

    corrected = real_client.post(
        f"/api/work-units/{wu_id}/field-ratifications/{draft['id']}/confirm", headers=headers,
        json={"action": "correct", "confirmed_by": "Sanooj", "value": "CHRO"},
    )
    assert corrected.status_code == 200, corrected.text
    body = corrected.json()
    assert body["status"] == "corrected"
    assert body["confirmed_value"] == "CHRO"

    wu = real_client.get(f"/api/work-units/{wu_id}", headers=headers).json()
    assert wu["authority"] == "CHRO"


@pg_skip
def test_confirm_or_correct_of_already_settled_row_is_409(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-FR-409")

    draft = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "the sitting quote about authority right here",
        "drafted_value": "Ops Lead",
    }).json()
    first = real_client.post(
        f"/api/work-units/{wu_id}/field-ratifications/{draft['id']}/confirm", headers=headers,
        json={"action": "confirm", "confirmed_by": "Sanooj"},
    )
    assert first.status_code == 200, first.text

    again = real_client.post(
        f"/api/work-units/{wu_id}/field-ratifications/{draft['id']}/confirm", headers=headers,
        json={"action": "correct", "confirmed_by": "Sanooj", "value": "CHRO"},
    )
    assert again.status_code == 409, again.text

    # Idempotent GET after that -- the row still reads confirmed, unaffected.
    reread = real_client.get(f"/api/work-units/{wu_id}/field-ratifications", headers=headers).json()
    row = next(r for r in reread["items"] if r["id"] == draft["id"])
    assert row["status"] == "confirmed"

    # A get-or-create POST for the same field now sees a settled row -- 409, not a new draft.
    redraft = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "irrelevant now, row already settled here",
        "drafted_value": "irrelevant",
    })
    assert redraft.status_code == 409, redraft.text


@pg_skip
def test_confirm_of_authority_does_not_lift_dual_employment_stop(real_client, two_tenants):
    """Confirming an unrelated field (authority) must not touch the columns
    the dual-employment stop check actually reads (failure_semantics,
    acceptance_criteria, evidence_required, context) -- WU-OD-02 stays
    not-ready for handoff if the stop language is missing, before and
    after the confirm."""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    # WU-OD-02 is a dual-employment code (services/handoff.py) with NO stop
    # language in failure_semantics -- the stop is missing by construction.
    # V10-11 (docs/contracts/v10-11-states.md): WU-OD-02 sits on the Offer
    # Desk journey, so it is now also scored for admissibility --
    # current_condition = desired_condition is a self-satisfying exit that
    # keeps this unit admissible so the dual-employment gate under test
    # here is the only thing that can refuse it.
    wu_id = _work_unit(
        real_client, headers, type_id, code="WU-OD-02",
        failure_semantics="hold and notify", acceptance_criteria="", evidence_required="", context="",
        current_condition="approved",
    )

    before = real_client.get("/api/spec/handoff/WU-OD-02", headers=headers)
    assert before.status_code == 200, before.text
    assert before.json()["ready"] is False
    assert before.json()["dual_employment_stop_required"] is True
    assert any("dual-employment stop" in r.lower() for r in before.json()["reasons"])

    draft = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "the sitting quote about authority right here",
        "drafted_value": "Ops Lead",
    }).json()
    confirmed = real_client.post(
        f"/api/work-units/{wu_id}/field-ratifications/{draft['id']}/confirm", headers=headers,
        json={"action": "confirm", "confirmed_by": "Sanooj"},
    )
    assert confirmed.status_code == 200, confirmed.text

    after = real_client.get("/api/spec/handoff/WU-OD-02", headers=headers)
    assert after.status_code == 200, after.text
    assert after.json()["ready"] is False
    assert after.json()["dual_employment_stop_required"] is True
    assert any("dual-employment stop" in r.lower() for r in after.json()["reasons"])


@pg_skip
def test_rls_field_ratifications_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    type_id = _type(real_client)
    wu_a = _work_unit(real_client, headers_a, type_id, code="WU-FR-RLS-A")

    draft = real_client.post(f"/api/work-units/{wu_a}/field-ratifications", headers=headers_a, json={
        "field_name": "authority", "sitting_quote": "the sitting quote about authority right here",
        "drafted_value": "Ops Lead",
    })
    assert draft.status_code == 200, draft.text
    rid = draft.json()["id"]

    # B cannot reach A's work unit at all -- 404, not a redacted 200.
    assert real_client.get(f"/api/work-units/{wu_a}/field-ratifications", headers=headers_b).status_code == 404
    assert real_client.get(f"/api/work-units/{wu_a}/decision-cards", headers=headers_b).status_code == 404
    cross_confirm = real_client.post(
        f"/api/work-units/{wu_a}/field-ratifications/{rid}/confirm", headers=headers_b,
        json={"action": "confirm", "confirmed_by": "intruder"},
    )
    assert cross_confirm.status_code == 404, cross_confirm.text

    # A's own read is unaffected.
    own = real_client.get(f"/api/work-units/{wu_a}/field-ratifications", headers=headers_a)
    assert own.status_code == 200, own.text
    assert own.json()["items"][0]["status"] == "drafted"


@pg_skip
def test_decision_cards_are_real_gaps_only_empty_is_honest(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-FR-CARDS", owner="")

    empty = real_client.get(f"/api/work-units/{wu_id}/decision-cards", headers=headers)
    assert empty.status_code == 200, empty.text
    assert empty.json()["items"] == []

    # A broken field_pointer raises a real conformance_gaps row (broken_pointer)
    # -- reuse that existing path rather than inventing a new gap kind.
    file_id = _upload(real_client, headers, b"Name,Value\nAlpha,100\n", "sheet.csv")
    ptr = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": file_id, "cell": "Z99",
    })
    assert ptr.status_code == 200, ptr.text
    gap_id = ptr.json()["gap_id"]
    assert gap_id is not None

    cards = real_client.get(f"/api/work-units/{wu_id}/decision-cards", headers=headers)
    assert cards.status_code == 200, cards.text
    items = cards.json()["items"]
    assert len(items) == 1
    card = items[0]
    assert card["gap_id"] == gap_id
    assert card["kind"] == "broken_pointer"
    assert card["named_human"] == "not named"  # owner="" on this unit
    assert card["action"] == "confirm_or_correct"


@pg_skip
def test_declared_pointer_present_quote_not_substring_is_422(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-FR-PTRQUOTE")
    file_id = _upload(real_client, headers, b"Name,Value\nAlpha Bravo Charlie,100\n", "sheet.csv")

    declared = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "authority", "status": "declared", "file_id": file_id, "cell": "A2",
        "quote": "Alpha Bravo Charlie",
    })
    assert declared.status_code == 200, declared.text
    assert declared.json()["status"] == "declared"

    mismatched = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "this text is not in the pointer quote",
        "drafted_value": "Ops Lead",
    })
    assert mismatched.status_code == 422, mismatched.text

    matching = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "Alpha Bravo", "drafted_value": "Ops Lead",
    })
    assert matching.status_code == 200, matching.text
    assert matching.json()["sitting_quote"] == "Alpha Bravo"


@pg_skip
def test_unique_client_work_unit_field_constraint(real_client, two_tenants):
    """DB-level unique constraint holds even bypassing the get-or-create
    service path (two racing requests can't both insert)."""
    headers = two_tenants["headers_a"]
    cid = two_tenants["client_a_id"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-FR-UNIQ")

    first = real_client.post(f"/api/work-units/{wu_id}/field-ratifications", headers=headers, json={
        "field_name": "authority", "sitting_quote": "the sitting quote about authority right here",
        "drafted_value": "Ops Lead",
    })
    assert first.status_code == 200, first.text

    session = SetupSession()
    with pytest.raises(Exception):
        session.execute(text(
            "INSERT INTO field_ratifications "
            "(client_id, work_unit_id, field_name, sitting_quote, drafted_value, status, created_at, updated_at) "
            "VALUES (:cid, :wid, 'authority', 'another quote here long enough', 'X', 'drafted', now(), now())"
        ), {"cid": cid, "wid": wu_id})
        session.commit()
    session.rollback()
    session.close()
