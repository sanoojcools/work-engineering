"""Slice 1 PR 1a (playbook E.1): file upload + server sha256, tested against
REAL Postgres, not the SQLite `client` fixture in conftest.py.

Why not conftest's fixture: TenantDbDep's tenant_db() issues
`SET app.current_client_id = :cid`, which is Postgres session-variable
syntax SQLite does not support. Every route behind TenantDbDep (files,
genome) has only ever been proven against real Postgres — this file makes
that proof permanent instead of a one-off manual script.

Skips cleanly (not a failure) if Postgres isn't reachable, so the pure-Python
suite (test_gqs.py, the two Slice 0 guards) still runs standalone.
"""
from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

PG_URL = "postgresql+psycopg2://wep:wep@localhost:5433/wep"  # superuser, setup/teardown only

try:
    _probe_engine = create_engine(PG_URL, pool_pre_ping=True)
    with _probe_engine.connect() as _c:
        _c.execute(text("SELECT 1"))
    POSTGRES_UP = True
except Exception:
    POSTGRES_UP = False

pytestmark = pytest.mark.skipif(not POSTGRES_UP, reason="Postgres not reachable at localhost:5433")

SetupSession = sessionmaker(bind=create_engine(PG_URL, pool_pre_ping=True)) if POSTGRES_UP else None


@pytest.fixture
def two_tenants():
    """Two throwaway clients + per-org keys, created/torn down via the wep
    superuser (bypasses RLS on purpose — this is setup, not the app path)."""
    session = SetupSession()
    raw_key_a = "test-upload-key-a-" + "x" * 20
    raw_key_b = "test-upload-key-b-" + "y" * 20
    hash_a = hashlib.sha256(raw_key_a.encode()).hexdigest()
    hash_b = hashlib.sha256(raw_key_b.encode()).hexdigest()

    client_a_id = session.execute(
        text("INSERT INTO clients (slug, name, industry, description, kind) "
             "VALUES ('test-upload-a', 'Test Upload A', '', '', 'client') RETURNING id")
    ).scalar()
    client_b_id = session.execute(
        text("INSERT INTO clients (slug, name, industry, description, kind) "
             "VALUES ('test-upload-b', 'Test Upload B', '', '', 'client') RETURNING id")
    ).scalar()
    session.execute(
        text("INSERT INTO org_api_keys (client_id, label, key_hash, is_active, created_at) "
             "VALUES (:cid, 'test-a', :h, true, now())"),
        {"cid": client_a_id, "h": hash_a},
    )
    session.execute(
        text("INSERT INTO org_api_keys (client_id, label, key_hash, is_active, created_at) "
             "VALUES (:cid, 'test-b', :h, true, now())"),
        {"cid": client_b_id, "h": hash_b},
    )
    session.commit()

    yield {"key_a": raw_key_a, "key_b": raw_key_b, "client_a_id": client_a_id, "client_b_id": client_b_id}

    ids = {"ids": [client_a_id, client_b_id]}
    # A gate-rejected import still writes a GenomeVersion (GQS scoring runs
    # before the file-provenance check), and an accepted one writes full
    # WorkUnit trees — teardown must cascade through both or the FK on
    # `clients` blocks deletion and leaves the row (and its slug) stuck for
    # the next test run, which is exactly what happened before this fix.
    session.execute(text(
        "DELETE FROM pii_field_values WHERE work_unit_id IN "
        "(SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text(
        "DELETE FROM work_unit_provenance WHERE work_unit_id IN "
        "(SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text(
        "DELETE FROM work_unit_regulatory_links WHERE work_unit_id IN "
        "(SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text(
        "DELETE FROM verdict_scores WHERE work_unit_id IN "
        "(SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text(
        "DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) "
        "OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM uploaded_files WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()
    session.close()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


CSV_BYTES = b"Step #,What happens\n1,Do the thing\n"


def test_upload_returns_server_computed_sha256(real_client, two_tenants):
    r = real_client.post(
        "/api/files/upload",
        headers={"X-Spec-Key": two_tenants["key_a"]},
        files={"file": ("sample.csv", CSV_BYTES, "text/csv")},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["sha256"] == hashlib.sha256(CSV_BYTES).hexdigest()
    assert body["file_name"] == "sample.csv"
    assert body["size"] == len(CSV_BYTES)


def test_same_bytes_two_tenants_two_isolated_rows(real_client, two_tenants):
    ra = real_client.post("/api/files/upload", headers={"X-Spec-Key": two_tenants["key_a"]},
                           files={"file": ("sample.csv", CSV_BYTES, "text/csv")})
    rb = real_client.post("/api/files/upload", headers={"X-Spec-Key": two_tenants["key_b"]},
                           files={"file": ("sample.csv", CSV_BYTES, "text/csv")})
    assert ra.status_code == 201 and rb.status_code == 201
    assert ra.json()["file_id"] != rb.json()["file_id"]
    assert ra.json()["sha256"] == rb.json()["sha256"]  # same bytes, same hash, still two rows

    # No GET /files endpoint in this PR — prove RLS isolation via direct
    # wep_app SELECT under each tenant's session var, per playbook E.1.
    app_engine = create_engine(
        "postgresql+psycopg2://wep_app:wep_app_dev_pw@localhost:5433/wep", pool_pre_ping=True
    )
    with app_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SET app.current_client_id = :cid"), {"cid": str(two_tenants["client_a_id"])})
            visible_to_a = conn.execute(text("SELECT id FROM uploaded_files")).fetchall()
        with conn.begin():
            conn.execute(text("SET app.current_client_id = :cid"), {"cid": str(two_tenants["client_b_id"])})
            visible_to_b = conn.execute(text("SELECT id FROM uploaded_files")).fetchall()

    a_ids = {row[0] for row in visible_to_a}
    b_ids = {row[0] for row in visible_to_b}
    assert int(ra.json()["file_id"]) in a_ids
    assert int(ra.json()["file_id"]) not in b_ids
    assert int(rb.json()["file_id"]) in b_ids
    assert int(rb.json()["file_id"]) not in a_ids


def test_no_key_401(real_client):
    r = real_client.post("/api/files/upload", files={"file": ("sample.csv", CSV_BYTES, "text/csv")})
    assert r.status_code == 401


def _fixed_genome_with_provenance(file_id, sha):
    import json
    from pathlib import Path
    samples_dir = Path(__file__).resolve().parents[2] / "samples"
    with open(samples_dir / "Private-Genome-MVP-HR-Ops-FIXED.json", encoding="utf-8") as f:
        genome = json.load(f)
    genome["dual_scoring_kappa"] = 0.85
    for wu in genome["work_units"]:
        wu["provenance"]["file_id"] = file_id
        wu["provenance"]["hash_sha256"] = sha
    return genome


def test_import_citing_unknown_file_id_400(real_client, two_tenants):
    genome = _fixed_genome_with_provenance("999999999", "a" * 64)
    r = real_client.post("/api/genome/import", headers={"X-Spec-Key": two_tenants["key_a"]}, json=genome)
    assert r.status_code == 400
    assert any(v["code"] == "unknown_file_id" for v in r.json()["detail"]["violations"])


def test_import_citing_known_file_id_wrong_hash_400(real_client, two_tenants):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": two_tenants["key_a"]},
                           files={"file": ("sample.csv", CSV_BYTES, "text/csv")})
    file_id = up.json()["file_id"]
    genome = _fixed_genome_with_provenance(file_id, "0" * 64)  # deliberately wrong
    r = real_client.post("/api/genome/import", headers={"X-Spec-Key": two_tenants["key_a"]}, json=genome)
    assert r.status_code == 400
    assert any(v["code"] == "file_hash_mismatch" for v in r.json()["detail"]["violations"])


def test_import_citing_known_file_id_matching_hash_not_rejected_for_that_reason(real_client, two_tenants):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": two_tenants["key_a"]},
                           files={"file": ("sample.csv", CSV_BYTES, "text/csv")})
    file_id, sha = up.json()["file_id"], up.json()["sha256"]
    genome = _fixed_genome_with_provenance(file_id, sha)
    r = real_client.post("/api/genome/import", headers={"X-Spec-Key": two_tenants["key_a"]}, json=genome)
    assert r.status_code == 201, r.text
    assert r.json()["gqs"] == pytest.approx(94.29, abs=0.01)
