"""The analysis routes (projections, verdict, economics, discovery,
work-graph, verification) are deliberately still unauthenticated — PR 3a
moved only work_units/spec/census onto per-org keys. But they run as
wep_app, which RLS binds, and nothing set app.current_client_id for them.

So they answered from whatever the pooled connection happened to be
carrying: usually nothing, which rendered Projections as "0 inventory,
0 work graph edges" for a tenant holding 14 work units and 20 edges, and
sometimes the previous caller's tenant.

`optional_tenant_db` pins the request to the caller's tenant when a key is
presented and changes nothing when one isn't. These tests hold both halves:
the data actually shows up, it is the right tenant's, and the routes stay
open to a caller with no key.

Real Postgres only — the whole defect is an RLS behaviour, and SQLite has
neither RLS nor `SET app.current_client_id`.
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


def _make_tenant(session, slug: str, unit_codes: list[str]) -> tuple[str, int]:
    """Built through the ORM rather than raw SQL: work_units carries a dozen
    NOT NULL columns and three enums, and the model already declares every
    default. SetupSession runs as wep (BYPASSRLS), so these inserts are not
    subject to the policy under test."""
    from app.models.client import Client
    from app.models.ontology import EntityType
    from app.models.security import OrgApiKey
    from app.models.workunit import WorkUnit

    entity_type = session.query(EntityType).filter(EntityType.name == "ProjBindingObject").one_or_none()
    if entity_type is None:
        entity_type = EntityType(name="ProjBindingObject", kind="business_object", description="")
        session.add(entity_type)
        session.flush()

    raw_key = f"test-{slug}-key-" + "b" * 20
    client = Client(slug=f"test-{slug}", name=f"test-{slug}", industry="", description="", kind="client")
    session.add(client)
    session.flush()
    session.add(OrgApiKey(
        client_id=client.id, label="test",
        key_hash=hashlib.sha256(raw_key.encode()).hexdigest(), is_active=True,
    ))
    for code in unit_codes:
        session.add(WorkUnit(
            client_id=client.id,
            code=code,
            name=f"Unit {code}",
            business_object_type_id=entity_type.id,
            current_condition="requested",
            desired_condition="done",
            owner="HR Ops",
        ))
    session.flush()
    return raw_key, client.id


def _cleanup(session, client_ids: list[int]) -> None:
    ids = {"ids": client_ids}
    session.execute(text(
        "DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) "
        "OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    # Gate 6/10 (docs/BUILD_PROGRAM.md Track 1) can leave conformance_gaps
    # rows referencing these work units -- must clear before the FK below.
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "proj-a", ["WU-PA-01", "WU-PA-02", "WU-PA-03"])
    key_b, cid_b = _make_tenant(session, "proj-b", ["WU-PB-01"])
    session.commit()
    session.close()
    yield {"key_a": key_a, "cid_a": cid_a, "key_b": key_b, "cid_b": cid_b}
    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


@pg_skip
def test_projections_return_the_callers_own_work_units(two_tenants):
    """The reported symptom: a tenant with work units saw an empty page."""
    from app.main import app

    with TestClient(app) as http:
        a = http.get("/api/projections/inventory", headers={"X-Spec-Key": two_tenants["key_a"]})
        assert a.status_code == 200, a.text
        codes = {row["code"] for row in a.json()["items"]}
        assert codes == {"WU-PA-01", "WU-PA-02", "WU-PA-03"}, "a tenant must see its own inventory"


@pg_skip
def test_a_key_pins_the_request_to_one_tenant(two_tenants):
    """Two different keys in a row on the same pooled connection must not
    bleed into each other — that bleed is what the old behaviour allowed."""
    from app.main import app

    with TestClient(app) as http:
        for _ in range(2):
            a = http.get("/api/projections/inventory", headers={"X-Spec-Key": two_tenants["key_a"]})
            b = http.get("/api/projections/inventory", headers={"X-Spec-Key": two_tenants["key_b"]})
            assert {r["code"] for r in a.json()["items"]} == {"WU-PA-01", "WU-PA-02", "WU-PA-03"}
            assert {r["code"] for r in b.json()["items"]} == {"WU-PB-01"}


@pg_skip
def test_work_graph_projection_sees_the_tenants_nodes(two_tenants):
    from app.main import app

    with TestClient(app) as http:
        r = http.get("/api/projections/work-graph", headers={"X-Spec-Key": two_tenants["key_a"]})
        assert r.status_code == 200, r.text
        assert len(r.json()["nodes"]) == 3


@pg_skip
def test_these_routes_stay_open_without_a_key(two_tenants):
    """This must not become authentication by the back door: PR 3a scoped
    per-org keys to work_units/spec/census, and a caller with no key still
    gets a normal response here rather than a 401."""
    from app.main import app

    with TestClient(app) as http:
        for path in ("/api/projections/inventory", "/api/projections/work-graph",
                     "/api/verdict/", "/api/economics/"):
            r = http.get(path)
            assert r.status_code != 401, f"{path} must not start requiring a key"


@pg_skip
def test_an_unrecognised_key_is_ignored_rather_than_rejected(two_tenants):
    from app.main import app

    with TestClient(app) as http:
        r = http.get("/api/projections/inventory", headers={"X-Spec-Key": "not-a-real-key"})
        assert r.status_code == 200, r.text
