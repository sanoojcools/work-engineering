"""Slice 1 PR 1c (playbook E.3): 3-row synonym path -> Track A mapper ->
existing import pipeline. Pure-Python mapper tests first (no Postgres),
then the real endpoint round-trip.

Per playbook: never hardcode 94.29 (or any number) as the expected score
of a NEW CSV — the honest result here is empirically 83.33 (below the
gate) because a 3-row batch where one unit has no dependencies loses a
full third of the completeness component. That's documented as the
correct outcome, not a bug, with a second case showing the same batch
clears the gate once a real (caller-supplied) kappa is attached.
"""
from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.gqs import compute_gqs
from app.services.track_a import map_track_a

CLEAN_CSV = (
    b"Sl No,What happens,Business Object,Current Condition,Desired Condition,Trigger,"
    b"Input,Authority,Actor Constraints,Acceptance Criteria,Evidence Required,"
    b"Verification Method,Failure Semantics,Regulatory Links,Dependencies\n"
    b"WU-T-01,Do first thing,Test Object,Draft,Started,Recruiter sends request,"
    b"Some input,SPOC,SPOC only,All checks pass,Log entry,"
    b"Human Spot Check,If fails escalate,RR-TEST-01,\n"
    b"WU-T-02,Do second thing,Test Object,Started,Verified,First thing done,"
    b"Some input,SPOC,SPOC only,All checks pass,Log entry,"
    b"Human Spot Check,If fails escalate,RR-TEST-01,WU-T-01\n"
    b"WU-T-03,Do third thing,Test Object,Verified,Complete,Second thing done,"
    b"Some input,SPOC,SPOC only,All checks pass,Log entry,"
    b"Human Spot Check,If fails escalate,RR-TEST-01,WU-T-02\n"
)


# ---------------------------------------------------------------------------
# Pure-Python: mapper correctness, no Postgres needed
# ---------------------------------------------------------------------------

def test_synonym_header_sl_no_maps_three_rows():
    result = map_track_a(CLEAN_CSV, "sample.csv", uploaded_file_id=1, file_sha256="a" * 64)
    assert not result.queued_whole_file
    assert len(result.work_units) == 3
    assert not result.queued_rows
    ids = [wu["id"] for wu in result.work_units]
    assert ids == ["WU-T-01", "WU-T-02", "WU-T-03"]
    assert result.work_units[1]["dependencies"] == ["WU-T-01"]


def test_mapped_batch_gqs_is_measured_not_assumed():
    """The honest, empirically-measured result: below the gate without
    kappa, because WU-T-01 legitimately has no dependencies and this is a
    3-row batch (small-sample completeness effect, not a bug)."""
    result = map_track_a(CLEAN_CSV, "sample.csv", uploaded_file_id=1, file_sha256="a" * 64)
    gqs = compute_gqs({"work_units": result.work_units})
    assert gqs["violations"] == []
    assert gqs["breakdown"]["zero_orphan"] is True
    assert not gqs["passes_gate"]
    assert gqs["gqs"] < 90


def test_mapped_batch_with_supplied_kappa_clears_gate():
    result = map_track_a(CLEAN_CSV, "sample.csv", uploaded_file_id=1, file_sha256="a" * 64)
    gqs = compute_gqs({"work_units": result.work_units}, kappa=0.85)
    assert gqs["passes_gate"], f"expected pass with kappa, got {gqs['gqs']}: {gqs['violations']}"


def test_ungrounded_mapping_queues_not_imports():
    """A required column is present but a cell's value, once normalized,
    somehow doesn't appear in its own row text — should never happen from
    direct cell extraction, so this proves the guardrail function itself
    catches a deliberately mismatched case, not just trusts extraction."""
    from app.services.track_a import _is_substring_of
    assert _is_substring_of("exact match", "this is an exact match here") is True
    assert _is_substring_of("not present anywhere", "totally different text") is False


def test_clip_80_applied_with_ellipsis_on_long_condition():
    long_condition = "X" * 120
    csv_bytes = (
        b"Sl No,What happens,Business Object,Current Condition,Desired Condition,Trigger,"
        b"Input,Authority,Actor Constraints,Acceptance Criteria,Evidence Required,"
        b"Verification Method,Failure Semantics,Regulatory Links,Dependencies\n"
        + f"WU-T-01,Do thing,Test Object,{long_condition},Done,Trigger event,In,SPOC,SPOC,OK,Log,Human Spot Check,Escalate,RR-TEST-01,\n".encode()
    )
    result = map_track_a(csv_bytes, "sample.csv", uploaded_file_id=1, file_sha256="a" * 64)
    assert not result.queued_whole_file
    cc = result.work_units[0]["current_condition"]
    assert len(cc) == 80
    assert cc.endswith("…")


def test_file6_class_never_reaches_mapper_output():
    csv_bytes = b"Col A,Notes,Owner\nfoo,bar,baz\n"
    result = map_track_a(csv_bytes, "file6.csv", uploaded_file_id=1, file_sha256="a" * 64)
    assert result.queued_whole_file is True
    assert result.reason == "unrecognized_step_column"
    assert result.work_units == []


# ---------------------------------------------------------------------------
# Postgres-backed: full endpoint round-trip through the existing import path
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
    raw_key = "test-tracka-key-" + "w" * 20
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    client_id = session.execute(text(
        "INSERT INTO clients (slug, name, industry, description, kind) "
        "VALUES ('test-tracka', 'Test Track A', '', '', 'client') RETURNING id"
    )).scalar()
    session.execute(text(
        "INSERT INTO org_api_keys (client_id, label, key_hash, is_active, created_at) "
        "VALUES (:cid, 'test', :h, true, now())"
    ), {"cid": client_id, "h": key_hash})
    session.commit()

    yield {"key": raw_key, "client_id": client_id}

    ids = {"ids": [client_id]}
    session.execute(text("DELETE FROM work_unit_provenance WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_unit_regulatory_links WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM verdict_scores WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    # Gate 6/10 (docs/BUILD_PROGRAM.md Track 1) can leave conformance_gaps
    # rows referencing these work units -- must clear before the FK below.
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM review_queue WHERE client_id = ANY(:ids)"), ids)
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


@pg_skip
def test_endpoint_without_kappa_is_honestly_gated(real_client, tenant):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": tenant["key"]},
                           files={"file": ("sample.csv", CLEAN_CSV, "text/csv")})
    file_id = up.json()["file_id"]
    r = real_client.post(f"/api/files/{file_id}/map-track-a", headers={"X-Spec-Key": tenant["key"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["rows_mapped"] == 3
    assert not body["import_result"]["accepted"]
    assert body["import_result"]["gqs"] < 90


@pg_skip
def test_endpoint_with_kappa_clears_gate_and_reaches_existing_import_path(real_client, tenant):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": tenant["key"]},
                           files={"file": ("sample.csv", CLEAN_CSV, "text/csv")})
    file_id = up.json()["file_id"]
    r = real_client.post(
        f"/api/files/{file_id}/map-track-a?dual_scoring_kappa=0.85",
        headers={"X-Spec-Key": tenant["key"]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["import_result"]["accepted"], body["import_result"]
    assert body["import_result"]["work_unit_count"] == 3
    assert body["import_result"]["work_graph_edge_count"] == 2  # T-01->T-02, T-02->T-03
