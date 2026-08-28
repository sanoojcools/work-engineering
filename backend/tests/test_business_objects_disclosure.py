"""Slice 2 PR 2a (playbook F.1): L1/L2/L3 progressive disclosure, tested
against the FIXED 14-unit sample. The BO count is measured from the
fixture at test setup, never asserted as a hardcoded marketing number.
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
    raw_key = f"test-{slug}-key-" + "u" * 20
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
    session.execute(text("DELETE FROM work_unit_provenance WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_unit_regulatory_links WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM verdict_scores WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def two_tenants_with_import():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "bo-a")
    key_b, cid_b = _make_tenant(session, "bo-b")
    session.commit()
    session.close()

    from app.main import app
    genome = _fixed_genome()
    with TestClient(app) as client:
        r = client.post("/api/genome/import", headers={"X-Spec-Key": key_a}, json=genome)
        assert r.status_code == 201, r.text
        version_id = r.json()["version_id"]

    yield {"key_a": key_a, "key_b": key_b, "client_a_id": cid_a, "client_b_id": cid_b, "version_id": version_id, "genome": genome}

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pg_skip
def test_l1_returns_distinct_business_object_set_measured_from_fixture(real_client, two_tenants_with_import):
    expected_bos = sorted({wu["business_object"] for wu in two_tenants_with_import["genome"]["work_units"]})
    vid = two_tenants_with_import["version_id"]
    r = real_client.get(f"/api/genome/{vid}/business-objects", headers={"X-Spec-Key": two_tenants_with_import["key_a"]})
    assert r.status_code == 200, r.text
    body = r.json()
    got_bos = sorted(bo["name"] for bo in body["business_objects"])
    assert got_bos == expected_bos
    total_wus = sum(bo["work_unit_count"] for bo in body["business_objects"])
    assert total_wus == len(two_tenants_with_import["genome"]["work_units"])
    for bo in body["business_objects"]:
        assert bo["needs_state_machine"] is True
        assert bo["state_machine"] == []


@pg_skip
def test_l2_returns_only_that_business_objects_work_units(real_client, two_tenants_with_import):
    vid = two_tenants_with_import["version_id"]
    bo_name = two_tenants_with_import["genome"]["work_units"][0]["business_object"]
    expected_ids = {wu["id"] for wu in two_tenants_with_import["genome"]["work_units"] if wu["business_object"] == bo_name}
    r = real_client.get(f"/api/genome/{vid}/business-objects/{bo_name}/work-units",
                         headers={"X-Spec-Key": two_tenants_with_import["key_a"]})
    assert r.status_code == 200, r.text
    got_ids = {wu["id"] for wu in r.json()["work_units"]}
    assert got_ids == expected_ids


@pg_skip
def test_l3_has_18_keys_and_context_variants_is_array(real_client, two_tenants_with_import):
    vid = two_tenants_with_import["version_id"]
    wu_id = two_tenants_with_import["genome"]["work_units"][0]["id"]
    r = real_client.get(f"/api/genome/{vid}/work-units/{wu_id}", headers={"X-Spec-Key": two_tenants_with_import["key_a"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "variant" not in body
    assert isinstance(body["context"]["variants"], list)
    expected_18 = {
        "id", "name", "business_object", "current_condition", "desired_condition", "context",
        "trigger", "input", "authority", "actor_constraints", "acceptance_criteria",
        "evidence_required", "verification_method", "sla_hours", "dependencies",
        "failure_semantics", "regulatory_register_link", "provenance",
    }
    assert expected_18.issubset(body.keys())


@pg_skip
def test_org_b_gets_404_on_all_three_levels(real_client, two_tenants_with_import):
    vid = two_tenants_with_import["version_id"]
    bo_name = two_tenants_with_import["genome"]["work_units"][0]["business_object"]
    wu_id = two_tenants_with_import["genome"]["work_units"][0]["id"]
    key_b = two_tenants_with_import["key_b"]

    assert real_client.get(f"/api/genome/{vid}/business-objects", headers={"X-Spec-Key": key_b}).status_code == 404
    assert real_client.get(f"/api/genome/{vid}/business-objects/{bo_name}/work-units", headers={"X-Spec-Key": key_b}).status_code == 404
    assert real_client.get(f"/api/genome/{vid}/work-units/{wu_id}", headers={"X-Spec-Key": key_b}).status_code == 404
