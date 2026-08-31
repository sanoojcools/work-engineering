"""A genome version has two numbers and they are not interchangeable:

- ``version_id`` is the table's global primary key. It is what URLs and every
  other genome route address, and it is shared across all tenants.
- ``sequence`` is the tenant's own count — the first genome a tenant imports
  is 1, whatever else the database holds.

The UI labelled versions with ``version_id``, so the very first import into a
freshly migrated database announced itself as "Sample genome v27": the id
sequence had been advanced by tenant bootstrap and by rolled-back attempts,
while the row's own ``sequence`` said 1 the whole time. These tests pin the
distinction and pin ``sequence`` into the payloads the UI reads, so a
tenant-scoped number is always available to display.
"""
from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.client import Client
from app.models.security import OrgApiKey
from app.services.genome_import import import_genome


def _work_unit(code: str, depends_on: str) -> dict:
    return {
        "id": code,
        "name": f"Do the thing {code}",
        "business_object": "Employee",
        "current_condition": "requested",
        "desired_condition": "done",
        "context": {"decision_branches": "none", "variants": []},
        "trigger": "a request arrives",
        "input": ["a form"],
        "authority": "HR Ops",
        "actor_constraints": "HR Ops only",
        "acceptance_criteria": ["the thing is done"],
        "evidence_required": ["a record id"],
        "verification_method": "database_constraint",
        "sla_timing": {"time_per_case_min": 30},
        "dependencies": [depends_on],
        "failure_semantics": "hold and notify",
        "regulatory_register_link": ["RR-001"],
        "provenance": {"source_type": "observed", "hash_sha256": "a" * 64},
    }


def _genome(codes: list[str]) -> dict:
    return {"work_units": [_work_unit(c, codes[0]) for c in codes], "dual_scoring_kappa": 0.85}


def _tenant(db, slug: str) -> Client:
    client = Client(slug=slug, name=slug, industry="", description="", kind="client")
    db.add(client)
    db.flush()
    db.add(OrgApiKey(
        client_id=client.id, label="t",
        key_hash=hashlib.sha256(slug.encode()).hexdigest(), is_active=True,
    ))
    db.commit()
    return client


def test_import_reports_both_the_global_id_and_the_tenant_sequence(db):
    client = _tenant(db, "numbering-co")
    result = import_genome(db, client.id, _genome(["WU-N-01"]), actor="test")

    assert result["accepted"] is True
    assert result["sequence"] == 1, "a tenant's first genome is v1"
    assert "version_id" in result


def test_a_new_tenants_first_genome_is_v1_however_high_the_ids_have_climbed(db):
    """The actual defect. The second tenant's first import is v1 to that
    tenant even though the primary key has moved on."""
    first = _tenant(db, "early-co")
    for codes in (["WU-E-01"], ["WU-E-02"], ["WU-E-03"]):
        import_genome(db, first.id, _genome(codes), actor="test")

    later = _tenant(db, "later-co")
    result = import_genome(db, later.id, _genome(["WU-L-01"]), actor="test")

    assert result["sequence"] == 1, "a fresh tenant must not inherit another tenant's numbering"
    assert result["version_id"] > 1, "precondition: the global id has advanced past 1"
    assert result["version_id"] != result["sequence"], (
        "this test is meaningless unless the two numbers actually differ here"
    )


def test_sequence_increments_per_tenant_and_counts_blocked_attempts(db):
    client = _tenant(db, "counting-co")

    v1 = import_genome(db, client.id, _genome(["WU-K-01"]), actor="test")
    assert v1["sequence"] == 1

    # A rejected import is still recorded, so it still takes a number — the
    # numbering is a log of attempts, not of successes.
    blocked = import_genome(db, client.id, _genome(["WU-K-01"]), actor="test")
    assert blocked["accepted"] is False
    assert blocked["sequence"] == 2

    v3 = import_genome(db, client.id, _genome(["WU-K-02"]), actor="test")
    assert v3["sequence"] == 3



# ---------------------------------------------------------------------------
# The HTTP half needs real Postgres: TenantDbDep issues `SET
# app.current_client_id`, which SQLite cannot parse. Same skip convention as
# test_rls_http.py and test_org_key_migration.py.
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
def numbering_tenant():
    session = SetupSession()
    raw_key = "test-numbering-key-" + "r" * 20
    client_id = session.execute(text(
        "INSERT INTO clients (slug, name, industry, description, kind) "
        "VALUES ('test-numbering', 'test-numbering', '', '', 'client') RETURNING id"
    )).scalar()
    session.execute(text(
        "INSERT INTO org_api_keys (client_id, label, key_hash, is_active, created_at) "
        "VALUES (:cid, 'test', :h, true, now())"
    ), {"cid": client_id, "h": hashlib.sha256(raw_key.encode()).hexdigest()})
    session.commit()
    session.close()

    yield {"client_id": client_id, "headers": {"X-Spec-Key": raw_key}}

    session = SetupSession()
    ids = {"ids": [client_id]}
    session.execute(text(
        "DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) "
        "OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM work_unit_provenance WHERE work_unit_id IN "
        "(SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM work_unit_regulatory_links WHERE work_unit_id IN "
        "(SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("UPDATE work_units SET genome_version_id = NULL WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()
    session.close()


@pg_skip
def test_sequence_is_exposed_on_the_routes_the_ui_reads(numbering_tenant):
    """/genome/versions, /genome/{id} and /genome/{id}/gqs all feed a version
    label in the UI, so every one of them has to carry the tenant number —
    otherwise the page has nothing to render but the primary key."""
    from app.main import app

    headers = numbering_tenant["headers"]
    with TestClient(app) as http:
        imported = http.post("/api/genome/import", json=_genome(["WU-X-01"]), headers=headers)
        assert imported.status_code == 201, imported.text
        body = imported.json()
        assert body["accepted"] is True, body
        assert body["sequence"] == 1
        vid = body["version_id"]

        listing = http.get("/api/genome/versions", headers=headers)
        assert listing.status_code == 200, listing.text
        assert [row["sequence"] for row in listing.json()["items"]] == [1]

        gqs = http.get(f"/api/genome/{vid}/gqs", headers=headers)
        assert gqs.status_code == 200, gqs.text
        assert gqs.json()["sequence"] == 1

        detail = http.get(f"/api/genome/{vid}", headers=headers)
        assert detail.status_code == 200, detail.text
        assert detail.json()["sequence"] == 1
