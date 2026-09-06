"""Slice 2 PR 2b (playbook F.2): whole / business_object / work_unit_ids /
intersection ratify, audit logging, Org B 404, version flag false until
every WU is covered.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

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
SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"


def _fixed_genome():
    with open(SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-FIXED.json", encoding="utf-8") as f:
        genome = json.load(f)
    genome["dual_scoring_kappa"] = 0.85
    return genome


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
    session.execute(text("DELETE FROM ratifications WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_unit_provenance WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_unit_regulatory_links WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM verdict_scores WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    # Gate 6/10 (docs/BUILD_PROGRAM.md Track 1) can leave conformance_gaps
    # rows referencing these work units -- must clear before the FK below.
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def imported():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "ratify-a")
    key_b, cid_b = _make_tenant(session, "ratify-b")
    session.commit()
    session.close()

    from app.main import app
    genome = _fixed_genome()
    with TestClient(app) as client:
        r = client.post("/api/genome/import", headers={"X-Spec-Key": key_a}, json=genome)
        assert r.status_code == 201, r.text
        version_id = r.json()["version_id"]

    yield {"key_a": key_a, "key_b": key_b, "version_id": version_id, "genome": genome, "client_a_id": cid_a}

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pg_skip
def test_whole_version_ratify_unchanged(real_client, imported):
    vid = imported["version_id"]
    r = real_client.post(f"/api/genome/{vid}/ratify", headers={"X-Spec-Key": imported["key_a"]}, json={})
    assert r.status_code == 200, r.text
    assert r.json()["ratified"] is True


@pg_skip
def test_business_object_scoped_ratify_partial_then_audit_logged(real_client, imported):
    vid = imported["version_id"]
    bo_name = imported["genome"]["work_units"][0]["business_object"]
    expected = {wu["id"] for wu in imported["genome"]["work_units"] if wu["business_object"] == bo_name}

    r = real_client.post(f"/api/genome/{vid}/ratify", headers={"X-Spec-Key": imported["key_a"]},
                          json={"business_object": bo_name, "approved": True, "comment": "looks right"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body["work_units_affected"]) == expected
    assert body["fully_ratified"] is False  # only one BO ratified, not the whole version

    app_engine = create_engine("postgresql+psycopg2://wep_app:wep_app_dev_pw@localhost:5433/wep")
    with app_engine.connect() as conn:
        with conn.begin():
            conn.execute(text("SET app.current_client_id = :cid"), {"cid": str(imported["client_a_id"])})
            rows = conn.execute(text(
                "SELECT action FROM audit_logs WHERE action = 'genome.ratify.business_object'"
            )).fetchall()
    assert len(rows) == 1


@pg_skip
def test_work_unit_ids_and_intersection(real_client, imported):
    vid = imported["version_id"]
    all_wus = imported["genome"]["work_units"]
    bo_name = all_wus[0]["business_object"]
    ids_in_bo = [wu["id"] for wu in all_wus if wu["business_object"] == bo_name]
    other_id = next((wu["id"] for wu in all_wus if wu["business_object"] != bo_name), None)

    # work_unit_ids only
    r1 = real_client.post(f"/api/genome/{vid}/ratify", headers={"X-Spec-Key": imported["key_a"]},
                           json={"work_unit_ids": [ids_in_bo[0]], "approved": True})
    assert r1.status_code == 200
    assert r1.json()["work_units_affected"] == [ids_in_bo[0]]

    if other_id and len(ids_in_bo) > 1:
        # intersection: business_object AND work_unit_ids that includes one outside the BO -> only the BO members count
        r2 = real_client.post(f"/api/genome/{vid}/ratify", headers={"X-Spec-Key": imported["key_a"]},
                               json={"business_object": bo_name, "work_unit_ids": [ids_in_bo[1], other_id], "approved": True})
        assert r2.status_code == 200
        assert set(r2.json()["work_units_affected"]) == {ids_in_bo[1]}


@pg_skip
def test_fully_ratified_flips_version_flag(real_client, imported):
    vid = imported["version_id"]
    all_ids = [wu["id"] for wu in imported["genome"]["work_units"]]
    r = real_client.post(f"/api/genome/{vid}/ratify", headers={"X-Spec-Key": imported["key_a"]},
                          json={"work_unit_ids": all_ids, "approved": True})
    assert r.status_code == 200, r.text
    assert r.json()["fully_ratified"] is True
    assert r.json()["ratified"] is True


@pg_skip
def test_org_b_ratify_404(real_client, imported):
    vid = imported["version_id"]
    r = real_client.post(f"/api/genome/{vid}/ratify", headers={"X-Spec-Key": imported["key_b"]}, json={})
    assert r.status_code == 404
