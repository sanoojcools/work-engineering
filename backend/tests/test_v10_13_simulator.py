"""V10-13 (docs/contracts/v10-13-simulator.md): case simulator for one
Offer -> Day-1 case, three scenarios, 18 leaves from
packs/hr/hire_leaves.yaml. Real Postgres only for the positive paths --
same reasoning test_handoff.py's own docstring gives (TenantDbDep's `SET
app.current_client_id` is Postgres-only syntax SQLite can't execute); the
401-without-key case runs on the plain sqlite `client` fixture because it
short-circuits before that SET ever runs.
"""
from __future__ import annotations

import hashlib

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.simulator import HIRE_LEAVES_PACK

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

with open(HIRE_LEAVES_PACK, encoding="utf-8") as _f:
    _PACK = yaml.safe_load(_f)
YAML_LEAVES = _PACK["leaves"]
YAML_LEAF_IDS = [leaf["id"] for leaf in YAML_LEAVES]


def _make_tenant(session, slug):
    raw_key = f"test-{slug}-key-" + "s" * 20
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
    for table in ("verdict_scores", "cost_profiles", "verification_designs"):
        session.execute(text(
            f"DELETE FROM {table} WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
        ), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def tenant(real_client):
    session = SetupSession()
    key, cid = _make_tenant(session, "sim")
    session.commit()
    session.close()
    yield {"headers": {"X-Spec-Key": key}, "client_id": cid}
    session = SetupSession()
    _cleanup(session, [cid])
    session.close()


def _make_work_unit(real_client, headers, cid, code, suffix, **overrides):
    et = real_client.post("/api/ontology/types", json={
        "name": f"test-sim-object-{cid}-{suffix}", "kind": "business_object",
    })
    assert et.status_code == 201, et.text
    body = {
        "code": code,
        "name": "Test simulator unit",
        "business_object_type_id": et.json()["id"],
        "current_condition": "unchecked",
        "desired_condition": "checked",
    }
    body.update(overrides)
    wu = real_client.post("/api/work-units/", headers=headers, json=body)
    assert wu.status_code == 201, wu.text
    return wu.json()


# --- 1. auth ----------------------------------------------------------

def test_requires_key(client):
    assert client.get("/api/simulations/offer-day1").status_code == 401


# --- 2. default scenario, leaf count/order, no 19th leaf ----------------

@pg_skip
def test_default_scenario_leaf_count_and_order(real_client, tenant):
    resp = real_client.get("/api/simulations/offer-day1", headers=tenant["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["scenario"] == "as_calculated"
    assert body["leaf_count"] == 18
    assert len(body["leaves"]) == 18
    assert [leaf["id"] for leaf in body["leaves"]] == YAML_LEAF_IDS


# --- 3. dual-employment stop unliftable on all three scenarios ----------

@pg_skip
@pytest.mark.parametrize("scenario", ["careful", "as_calculated", "ambitious"])
def test_wu_hire_05_blocked_on_every_scenario(real_client, tenant, scenario):
    resp = real_client.get(
        "/api/simulations/offer-day1", headers=tenant["headers"], params={"scenario": scenario}
    )
    assert resp.status_code == 200, resp.text
    leaves = {leaf["id"]: leaf for leaf in resp.json()["leaves"]}
    hire05 = leaves["WU-HIRE-05"]
    assert hire05["fires"] == "blocked"
    assert hire05["blocked_reason"] == "dual_employment"
    assert hire05["stop"] is True
    assert {"id": "WU-HIRE-05", "reason": "dual_employment"} in resp.json()["spec_blocks"]


# --- 4. external leaf is "outside", never "yes" -------------------------

@pg_skip
@pytest.mark.parametrize("scenario", ["careful", "as_calculated", "ambitious"])
def test_wu_hire_01_external_is_outside(real_client, tenant, scenario):
    resp = real_client.get(
        "/api/simulations/offer-day1", headers=tenant["headers"], params={"scenario": scenario}
    )
    leaves = {leaf["id"]: leaf for leaf in resp.json()["leaves"]}
    assert leaves["WU-HIRE-01"]["band"] == "external"
    assert leaves["WU-HIRE-01"]["fires"] == "outside"


# --- 5. careful floors augment to human_must_touch -----------------------

@pg_skip
def test_careful_treats_augment_as_human_must_touch(real_client, tenant):
    careful = real_client.get(
        "/api/simulations/offer-day1", headers=tenant["headers"], params={"scenario": "careful"}
    ).json()
    as_calc = real_client.get(
        "/api/simulations/offer-day1", headers=tenant["headers"], params={"scenario": "as_calculated"}
    ).json()

    careful_leaf = {leaf["id"]: leaf for leaf in careful["leaves"]}["WU-HIRE-03"]
    as_calc_leaf = {leaf["id"]: leaf for leaf in as_calc["leaves"]}["WU-HIRE-03"]
    assert careful_leaf["band"] == "augment"
    assert careful_leaf["fires"] == "human_must_touch"
    assert "WU-HIRE-03" in careful["human_must_touch"]
    assert as_calc_leaf["fires"] == "yes"
    assert "WU-HIRE-03" not in as_calc["human_must_touch"]


# --- 6. capacity block: not_live, 95/61.8, peak_fte_stated = 95/160 ------

@pg_skip
def test_capacity_labelled_not_live(real_client, tenant):
    body = real_client.get("/api/simulations/offer-day1", headers=tenant["headers"]).json()
    capacity = body["capacity"]
    assert capacity["labelled"] == "not_live"
    assert capacity["stated_hours_mo"] == 95
    assert capacity["defended_hours_mo"] == 61.8
    assert capacity["peak_fte_stated"] == pytest.approx(95 / 160)
    assert "not live" in capacity["if_we_ran_this"].lower()
    # never printed on a leaf (hire_leaves.yaml's own instruction)
    for leaf in body["leaves"]:
        assert leaf.get("defended_hours_mo") is None


# --- 7. fresh tenant: no fabricated 18 scored units ----------------------

@pg_skip
def test_fresh_tenant_all_leaves_not_scored(real_client, tenant):
    body = real_client.get("/api/simulations/offer-day1", headers=tenant["headers"]).json()
    not_scored = [leaf for leaf in body["leaves"] if leaf["actual"] == "not_scored"]
    assert len(not_scored) >= 17
    hire05 = {leaf["id"]: leaf for leaf in body["leaves"]}["WU-HIRE-05"]
    assert hire05["fires"] == "blocked"          # expected fires, from yaml, always
    assert hire05["actual"] == "not_scored"      # no WU-OD-02 on this fresh tenant


# --- 8. dual-employment stop on a real WU-OD-02 handoff is still unliftable, ambitious included

@pg_skip
def test_dual_employment_stop_unliftable_on_ambitious_with_real_twin(real_client, tenant):
    # No dual-employment language stated -- same shape as
    # test_handoff.py::test_dual_employment_unit_not_ready_without_the_stop_stated.
    _make_work_unit(
        real_client, tenant["headers"], tenant["client_id"], "WU-OD-02", "sim8",
        acceptance_criteria="All documents present", evidence_required="Zwayam event",
        current_condition="checked", sla_hours=4,
    )
    body = real_client.get(
        "/api/simulations/offer-day1", headers=tenant["headers"], params={"scenario": "ambitious"}
    ).json()
    hire05 = {leaf["id"]: leaf for leaf in body["leaves"]}["WU-HIRE-05"]
    assert hire05["fires"] == "blocked"
    assert hire05["actual"] == "blocked"


# --- 9. unknown scenario is 422 -----------------------------------------

@pg_skip
def test_unknown_scenario_422(real_client, tenant):
    resp = real_client.get(
        "/api/simulations/offer-day1", headers=tenant["headers"], params={"scenario": "reckless"}
    )
    assert resp.status_code == 422


# --- 10. scenario aliases map, not exposed as the only names ------------

@pg_skip
@pytest.mark.parametrize("alias,real_name", [("s1", "careful"), ("s2", "as_calculated"), ("s3", "ambitious")])
def test_scenario_aliases_map_to_real_names(real_client, tenant, alias, real_name):
    resp = real_client.get(
        "/api/simulations/offer-day1", headers=tenant["headers"], params={"scenario": alias}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["scenario"] == real_name
