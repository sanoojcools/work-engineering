"""Slice 1 PR 1b (playbook E.2). Two tiers:
- Pure-Python unit tests for score_header_cell/classify (no Postgres needed).
- Postgres-backed tests proving the /classify endpoint queues File-6-class
  sheets and never calls the import service — same skip-if-unreachable
  pattern as test_file_upload_sha256.py.
"""
from __future__ import annotations

import hashlib
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.classifier import classify, levenshtein, score_header_cell

# ---------------------------------------------------------------------------
# Pure-Python: no Postgres required
# ---------------------------------------------------------------------------

def test_exact_canonical_header_scores_1_0():
    assert score_header_cell("Step #") == 1.0


def test_synonym_sl_no_scores_0_8():
    assert score_header_cell("Sl No") == 0.8


def test_fuzzy_stp_no_scores_0_6():
    # Pin the exact distance so the rule can't silently drift if the
    # synonym list changes later (playbook: "encode the exact pair").
    assert levenshtein("Stp No", "Step No") == 1
    assert levenshtein("Stp No", "Step No") <= 2
    assert score_header_cell("Stp No") == 0.6


def test_unrelated_header_scores_0_3():
    assert score_header_cell("Owner") == 0.3


def test_classify_recognizes_sl_no_as_header_row():
    csv_bytes = b"Sl No,What happens\n1,Do the thing\n"
    result = classify(csv_bytes, "sample.csv")
    assert not result.queued
    assert result.step_identity_confidence == 0.8
    assert result.header_cells[result.step_identity_column] == "Sl No"


def test_classify_file6_class_queues_whole_file():
    """Headers unrelated to Step identity, no synonym within distance 2 -
    the exact File-6-class scenario from the playbook."""
    csv_bytes = b"Col A,Notes,Owner\nfoo,bar,baz\n"
    result = classify(csv_bytes, "file6.csv")
    assert result.queued is True
    assert result.header_row_index is None


def test_classify_stops_mapping_when_only_fuzzy_column_present():
    """A file whose ONLY step-identity-like header never reaches the 0.7
    queue threshold (Stp No scores 0.6) must queue, not guess."""
    csv_bytes = b"Stp No,What happens\n1,Do the thing\n"
    result = classify(csv_bytes, "fuzzy_only.csv")
    assert result.queued is True


def test_classify_captures_metadata_block_without_inventing_work_units():
    csv_bytes = b"Workflow Name,Test Workflow\nOutcome,Some outcome\n\nStep #,What happens\n1,Do it\n"
    result = classify(csv_bytes, "with_metadata.csv")
    assert not result.queued
    assert result.metadata_notes == {"Workflow Name": "Test Workflow", "Outcome": "Some outcome"}
    assert result.header_cells[result.step_identity_column] == "Step #"


def test_classifier_module_never_imports_genome_import():
    """Structural guardrail: PR 1b must not call the import service."""
    import app.services.classifier as clf_module
    assert "genome_import" not in clf_module.__dict__
    assert not hasattr(clf_module, "import_genome")


# ---------------------------------------------------------------------------
# Postgres-backed: /classify endpoint + review_queue
# ---------------------------------------------------------------------------

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


@pytest.fixture
def tenant():
    session = SetupSession()
    raw_key = "test-classify-key-" + "z" * 20
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    client_id = session.execute(text(
        "INSERT INTO clients (slug, name, industry, description, kind) "
        "VALUES ('test-classify', 'Test Classify', '', '', 'client') RETURNING id"
    )).scalar()
    session.execute(text(
        "INSERT INTO org_api_keys (client_id, label, key_hash, is_active, created_at) "
        "VALUES (:cid, 'test', :h, true, now())"
    ), {"cid": client_id, "h": key_hash})
    session.commit()

    yield {"key": raw_key, "client_id": client_id}

    ids = {"ids": [client_id]}
    session.execute(text("DELETE FROM review_queue WHERE client_id = ANY(:ids)"), ids)
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


@pg_skip
def test_classify_endpoint_recognizes_sl_no(real_client, tenant):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": tenant["key"]},
                           files={"file": ("sample.csv", b"Sl No,What happens\n1,Do it\n", "text/csv")})
    file_id = up.json()["file_id"]
    r = real_client.post(f"/api/files/{file_id}/classify", headers={"X-Spec-Key": tenant["key"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["queued"] is False
    assert body["step_identity_confidence"] == 0.8


@pg_skip
def test_classify_endpoint_file6_class_queues_and_never_imports(real_client, tenant):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": tenant["key"]},
                           files={"file": ("file6.csv", b"Col A,Notes,Owner\nfoo,bar,baz\n", "text/csv")})
    file_id = up.json()["file_id"]

    with patch("app.services.genome_import.import_genome") as mock_import:
        r = real_client.post(f"/api/files/{file_id}/classify", headers={"X-Spec-Key": tenant["key"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["queued"] is True
        assert body["reason"] == "unrecognized_step_column"
        mock_import.assert_not_called()

    # Verify the ReviewQueueItem actually landed (as the tenant, under RLS).
    app_engine = create_engine("postgresql+psycopg2://wep_app:wep_app_dev_pw@localhost:5433/wep")
    with app_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SET app.current_client_id = :cid"), {"cid": str(tenant["client_id"])})
            rows = conn.execute(text(
                "SELECT reason, file_id FROM review_queue WHERE file_id = :fid"
            ), {"fid": int(file_id)}).fetchall()
    assert len(rows) == 1
    assert rows[0][0] == "unrecognized_step_column"


@pg_skip
def test_classify_does_not_create_work_units(real_client, tenant):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": tenant["key"]},
                           files={"file": ("sample.csv", b"Step #,What happens\n1,Do it\n", "text/csv")})
    file_id = up.json()["file_id"]
    real_client.post(f"/api/files/{file_id}/classify", headers={"X-Spec-Key": tenant["key"]})

    app_engine = create_engine("postgresql+psycopg2://wep_app:wep_app_dev_pw@localhost:5433/wep")
    with app_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SET app.current_client_id = :cid"), {"cid": str(tenant["client_id"])})
            count = conn.execute(text("SELECT count(*) FROM work_units")).scalar()
    assert count == 0
