"""Slice 1 PR 1c (playbook E.3, v0.7 addition): a dependency referencing a
Work Unit not present in the same mapped batch must land in review_queue,
not vanish silently. No Sequence edge is created to the missing target
either way (existing write behavior) — the queue row is the visibility
layer on top of that, so a human can add the missing unit or drop the
reference.
"""
from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.track_a import find_orphan_dependencies, map_track_a

ORPHAN_CSV = (
    b"Sl No,What happens,Business Object,Current Condition,Desired Condition,Trigger,"
    b"Input,Authority,Actor Constraints,Acceptance Criteria,Evidence Required,"
    b"Verification Method,Failure Semantics,Regulatory Links,Dependencies\n"
    b"WU-O-01,Do the thing,Test Object,Draft,Done,Trigger event,In,SPOC,SPOC,OK,Log,"
    b"Human Spot Check,Escalate,RR-TEST-01,WU-DOES-NOT-EXIST\n"
)


def test_orphan_dependency_detected_by_pure_function():
    result = map_track_a(ORPHAN_CSV, "sample.csv", uploaded_file_id=1, file_sha256="a" * 64)
    assert not result.queued_whole_file
    assert len(result.work_units) == 1
    orphans = find_orphan_dependencies(result.work_units)
    assert len(orphans) == 1
    assert orphans[0]["dependency_id"] == "WU-DOES-NOT-EXIST"
    assert orphans[0]["wu_id"] == "WU-O-01"


# ---------------------------------------------------------------------------
# Postgres-backed: endpoint creates the ReviewQueueItem, no Sequence edge
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
    raw_key = "test-orphan-key-" + "v" * 20
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    client_id = session.execute(text(
        "INSERT INTO clients (slug, name, industry, description, kind) "
        "VALUES ('test-orphan', 'Test Orphan', '', '', 'client') RETURNING id"
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
def test_orphan_creates_review_queue_item_and_no_sequence_edge(real_client, tenant):
    up = real_client.post("/api/files/upload", headers={"X-Spec-Key": tenant["key"]},
                           files={"file": ("orphan.csv", ORPHAN_CSV, "text/csv")})
    file_id = up.json()["file_id"]
    r = real_client.post(f"/api/files/{file_id}/map-track-a", headers={"X-Spec-Key": tenant["key"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["orphans_flagged"] == 1

    app_engine = create_engine("postgresql+psycopg2://wep_app:wep_app_dev_pw@localhost:5433/wep")
    with app_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SET app.current_client_id = :cid"), {"cid": str(tenant["client_id"])})
            rq_rows = conn.execute(text(
                "SELECT reason, raw_text FROM review_queue WHERE file_id = :fid AND reason = 'orphan_dependency'"
            ), {"fid": int(file_id)}).fetchall()
            edge_count = conn.execute(text(
                "SELECT count(*) FROM work_edges we JOIN work_units wu ON we.source_id = wu.id "
                "WHERE wu.client_id = :cid"
            ), {"cid": tenant["client_id"]}).scalar()

    assert len(rq_rows) == 1
    assert "WU-DOES-NOT-EXIST" in rq_rows[0][1]
    assert edge_count == 0  # no Sequence edge to the missing target
