"""V10-2 (docs/V10_BUILD.md): field pointer resolver, five statuses, and
binding-field enforcement (services/pointers.py). Real Postgres only for the
positive paths -- TenantDbDep's `SET app.current_client_id` is Postgres-
specific syntax SQLite can't execute (same reason test_rls_http.py /
test_censuses.py are real-Postgres-only); the SQLite `client` fixture is
fine for the missing-key 401 case since that never reaches tenant_db().
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

# Row 1 (header) / Row 2 / Row 3 in Excel-style 1-indexing -- "B2" -> "100",
# "A2" -> "Alpha".
CSV_CONTENT = b"Name,Value\nAlpha,100\nBeta,200\n"
PDF_CONTENT = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"


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
    key_a, cid_a = _make_tenant(session, "ptr-a")
    key_b, cid_b = _make_tenant(session, "ptr-b")
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
        "name": "V10-2 Pointer Test Object", "kind": "business_object", "state_machine": '["draft","done"]',
    })
    if r.status_code == 409:
        existing = real_client.get("/api/ontology/types").json()["items"]
        return next(t["id"] for t in existing if t["name"] == "V10-2 Pointer Test Object")
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _work_unit(real_client, headers, type_id, code="WU-PTR-01") -> int:
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


def _fabrication_count(real_client, client_id: int) -> int:
    rows = real_client.get("/api/clients/").json()["items"]
    return next(c["fabrication_count"] for c in rows if c["id"] == client_id)


def test_pointers_rejects_missing_key(client):
    assert client.get("/api/work-units/1/pointers").status_code == 401
    assert client.post(
        "/api/work-units/1/pointers", json={"field_name": "trigger", "status": "observed"},
    ).status_code == 401


@pg_skip
def test_no_key_401(real_client, two_tenants):
    for headers in ({}, {"X-Spec-Key": "not-a-real-key"}):
        assert real_client.get("/api/work-units/1/pointers", headers=headers).status_code == 401
        assert real_client.post(
            "/api/work-units/1/pointers", headers=headers, json={"field_name": "trigger", "status": "observed"},
        ).status_code == 401


@pg_skip
def test_broken_pointer_cannot_stay_observed(real_client, two_tenants):
    """The paradigm case: an observed claim whose cell is out of range for
    the cited file must not be persisted as observed. It is downgraded to
    predicted, a ConformanceGap(kind=broken_pointer) is raised, and the
    tenant's fabrication_count goes up by exactly one."""
    headers = two_tenants["headers_a"]
    cid = two_tenants["client_a_id"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-BROKEN")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")
    before = _fabrication_count(real_client, cid)

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": file_id, "cell": "Z99",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["requested_status"] == "observed"
    assert body["status"] == "predicted"
    assert body["resolved"] is False
    assert "out of range" in body["resolution_note"]
    assert body["gap_id"] is not None

    gaps = real_client.get("/api/discovery/gaps", headers=headers, params={"client_id": cid}).json()["items"]
    gap = next(g for g in gaps if g["id"] == body["gap_id"])
    assert gap["kind"] == "broken_pointer"
    assert gap["work_unit_id"] == wu_id
    assert gap["declared_ref"] == "WU-PTR-BROKEN:trigger"

    assert _fabrication_count(real_client, cid) == before + 1

    # Persisted, not just the response -- a fresh read shows the same downgrade.
    reread = real_client.get(f"/api/work-units/{wu_id}/pointers/trigger", headers=headers).json()
    assert reread["status"] == "predicted"


@pg_skip
def test_reconstructed_also_downgrades_on_broken_pointer(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-RECON")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "inputs", "status": "reconstructed", "file_id": file_id, "cell": "not-a-cell",
    })
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "predicted"
    assert r.json()["resolved"] is False


@pg_skip
def test_csv_pointer_without_cell_cannot_open(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-NOCELL")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": file_id,
    })
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "predicted"
    assert "must give a cell" in r.json()["resolution_note"]


@pg_skip
def test_valid_cell_pointer_stays_observed_no_gap(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    cid = two_tenants["client_a_id"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-GOOD")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")
    before = _fabrication_count(real_client, cid)

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": file_id, "cell": "B2",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "observed"
    assert body["resolved"] is True
    assert body["gap_id"] is None

    assert _fabrication_count(real_client, cid) == before  # unchanged -- nothing fabricated


@pg_skip
def test_upsert_is_idempotent_by_field(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-UPSERT")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    first = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": file_id, "cell": "B2",
    }).json()
    second = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": file_id, "cell": "A2",
    }).json()

    assert second["id"] == first["id"]
    assert second["cell"] == "A2"
    listed = real_client.get(f"/api/work-units/{wu_id}/pointers", headers=headers).json()
    assert listed["total"] == 1


@pg_skip
def test_binding_field_rejects_predicted_and_composed(real_client, two_tenants):
    """V10_BUILD.md: 'Reject predicted/composed as binding.'"""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-BIND-REJ")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    for bad_status in ("predicted", "composed", "observed", "reconstructed"):
        r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
            "field_name": "authority", "status": bad_status, "file_id": file_id, "cell": "A2", "quote": "Alpha",
        })
        assert r.status_code == 422, (bad_status, r.text)

    # Nothing was persisted by any of the rejected attempts.
    assert real_client.get(f"/api/work-units/{wu_id}/pointers/authority", headers=headers).status_code == 404


@pg_skip
def test_binding_field_declared_requires_quote(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-BIND-NOQUOTE")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "acceptance_criteria", "status": "declared", "file_id": file_id, "cell": "A2",
    })
    assert r.status_code == 422, r.text
    assert "quote" in r.json()["detail"].lower()


@pg_skip
def test_binding_field_declared_with_broken_pointer_is_rejected_not_downgraded(real_client, two_tenants):
    """Binding fields never get the silent-downgrade treatment -- either the
    quote is verified against an opened pointer, or the write is refused."""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-BIND-BROKEN")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "actor_constraints", "status": "declared", "file_id": file_id,
        "cell": "A2", "quote": "this text is not in the cell",
    })
    assert r.status_code == 422, r.text
    assert real_client.get(f"/api/work-units/{wu_id}/pointers/actor_constraints", headers=headers).status_code == 404


@pg_skip
def test_binding_field_declared_with_verified_quote_succeeds(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-BIND-OK")
    file_id = _upload(real_client, headers, CSV_CONTENT, "sheet.csv")

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "authority", "status": "declared", "file_id": file_id, "cell": "A2", "quote": "Alpha",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "declared"
    assert body["resolved"] is True
    assert body["gap_id"] is None


@pg_skip
def test_pdf_pointer_is_file_only_and_cannot_satisfy_binding(real_client, two_tenants):
    """V10_BUILD.md: 'PDF this PR = file-only, HONESTY if no line parser.'
    A PDF-sourced pointer can back a non-binding field as file-level
    evidence, but cannot satisfy a binding field's verified-quote bar --
    there is no parser this PR to confirm the quote is actually in it."""
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-PDF")
    file_id = _upload(real_client, headers, PDF_CONTENT, "policy.pdf")

    non_binding = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "context", "status": "observed", "file_id": file_id,
    })
    assert non_binding.status_code == 200, non_binding.text
    body = non_binding.json()
    assert body["status"] == "observed"
    assert body["resolved"] is True
    assert body["page"] is None and body["line"] is None and body["cell"] is None

    binding = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "authority", "status": "declared", "file_id": file_id, "quote": "anything",
    })
    assert binding.status_code == 422, binding.text

    # Asking for a page on a PDF this PR is honestly refused, not guessed.
    with_page = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "inputs", "status": "observed", "file_id": file_id, "page": 1,
    })
    assert with_page.status_code == 200, with_page.text
    assert with_page.json()["status"] == "predicted"
    assert with_page.json()["resolved"] is False


@pg_skip
def test_unknown_field_name_rejected(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-BADFIELD")

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "not_a_real_field", "status": "predicted",
    })
    assert r.status_code == 422, r.text


@pg_skip
def test_missing_file_id_404s(real_client, two_tenants):
    headers = two_tenants["headers_a"]
    type_id = _type(real_client)
    wu_id = _work_unit(real_client, headers, type_id, code="WU-PTR-NOFILE")

    r = real_client.post(f"/api/work-units/{wu_id}/pointers", headers=headers, json={
        "field_name": "trigger", "status": "observed", "file_id": 999999999,
    })
    assert r.status_code == 404, r.text


@pg_skip
def test_rls_pointers_isolation_via_http(real_client, two_tenants):
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]
    type_id = _type(real_client)
    wu_a = _work_unit(real_client, headers_a, type_id, code="WU-PTR-RLS-A")
    file_a = _upload(real_client, headers_a, CSV_CONTENT, "sheet.csv")

    created = real_client.post(f"/api/work-units/{wu_a}/pointers", headers=headers_a, json={
        "field_name": "trigger", "status": "observed", "file_id": file_a, "cell": "B2",
    })
    assert created.status_code == 200, created.text

    # B cannot reach A's work unit at all -- 404, not a redacted 200.
    assert real_client.get(f"/api/work-units/{wu_a}/pointers", headers=headers_b).status_code == 404
    assert real_client.get(f"/api/work-units/{wu_a}/pointers/trigger", headers=headers_b).status_code == 404
    cross_write = real_client.post(f"/api/work-units/{wu_a}/pointers", headers=headers_b, json={
        "field_name": "trigger", "status": "observed", "file_id": file_a, "cell": "B2",
    })
    assert cross_write.status_code == 404, cross_write.text

    # A's own read is unaffected.
    own = real_client.get(f"/api/work-units/{wu_a}/pointers/trigger", headers=headers_a)
    assert own.status_code == 200, own.text
