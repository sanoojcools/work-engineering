"""Slice 2 PR 2c (playbook F.3): GET /automation-index — hours current/
saveable computed only from sla_timing fields actually present on a Work
Unit (no imputed cost), plus the Shared Object and Shared Resource /
bus-factor-1 detectors that persist new work_edges rows.

The genome here is hand-built (not the FIXED sample) so every number in the
assertions below is exactly traceable to a value written into the fixture,
per the "never a hardcoded marketing number" convention used elsewhere in
this test suite.
"""
from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.genome_import import _map_verification_method
from app.services.pii import redact
from app.services.automation_index import (
    BUS_FACTOR_HOURS_PER_DAY,
    BUS_FACTOR_WU_THRESHOLD,
    WORKING_DAYS_PER_MONTH,
)
from app.models.workunit import VerificationMethod

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

AUTHORITY_BUS_FACTOR_FIRES = "Firebrand Authority Q"   # >3 WUs, high load -> must fire
AUTHORITY_BUS_FACTOR_QUIET = "Quiet Authority R"       # >3 WUs, low load -> must NOT fire
BO_ALPHA = "Case Alpha"
BO_BETA = "Case Beta"


def _wu(wu_id, *, business_object, authority, sla_timing, verdict, verification_method, dependencies=None):
    return {
        "id": wu_id,
        "name": f"Do the {wu_id} thing",
        "business_object": business_object,
        "current_condition": "Started",
        "desired_condition": "Completed",
        "context": {"decision_branches": "none", "variants": []},
        "trigger": "Trigger fires",
        "input": ["Case reference"],
        "authority": authority,
        "actor_constraints": "Any qualified actor",
        "acceptance_criteria": ["Marked done"],
        "evidence_required": ["Completion log"],
        "verification_method": verification_method,
        "sla_timing": sla_timing,
        "dependencies": dependencies or [],
        "failure_semantics": "Retry once then escalate",
        # GQS completeness (_wu_is_complete) treats an empty list as a
        # missing attribute even though "unregulated" is a legitimate real
        # value — that's the existing, locked GQS formula, not something
        # this PR changes, so every WU here carries a stub RR id instead.
        "regulatory_register_link": ["RR-TEST-01"],
        "provenance": {"source_type": "observed", "file_id": None, "row": None, "col": None,
                        "hash_sha256": None, "notes": "test fixture"},
        "verdict": verdict,
    }


def _build_genome():
    """
    Group A ("Shared Authority Q", business_object=Case Alpha): 4 WUs,
      time_per_case_min=180, volume_per_month=100 -> 300 hrs/mo each,
      verdict V..T=4 -> recommended_level 4 (saveable). wu_count(4) >
      BUS_FACTOR_WU_THRESHOLD(3) and hours/day = 1200/22 = 54.5 >
      BUS_FACTOR_HOURS_PER_DAY(6) -> bus_factor_1 True.
    Group B ("Shared Authority R", business_object=Case Beta): 4 WUs,
      time_per_case_min=10, volume_per_month=5 -> 0.8333 hrs/mo each,
      verdict V..T=2 -> level 2 (not saveable). Same wu_count as Group A but
      hours/day = 3.333/22 = 0.15 < 6 -> bus_factor_1 False: the fixture
      that must not fire even though the WU-count half of the rule is met.
    WU-C1: time_per_case_min set, volume_per_month absent -> hours unknown,
      omitted from every hours total despite a saveable-eligible verdict.
    WU-D1: both time+volume present (10 hrs/mo) but no verdict block at all
      -> counts toward verdict_missing_count, hours counted as current but
      never as saveable.

    Every WU carries a non-empty `dependencies` entry (each group forms a
    3-edge chain rooted at its first WU; C1 depends on D1 one-way) purely
    so GQS completeness clears the >=90 import gate — Sequence edges from
    these chains are not otherwise meaningful and are asserted on for
    their count only (7). Each group used to be a 4-edge ring (and C1/D1
    a 2-edge mutual pair) -- a genuine cycle, now a real, separate
    violation (_detect_dependency_cycles in genome_import.py) this
    fixture isn't testing; broken the same way the real FIXED sample
    genome's own mutual pairs were (see test_fixed_sample_hours_
    honestly_zero_and_sequence_count_unchanged below): keep one
    direction, let the other end become a root with a placeholder
    dependency instead of naming a WU that would close the loop.
    """
    genome = {
        "function_pack": "test_pack",
        "dual_scoring_kappa": 0.85,
        "work_units": [
            _wu("WU-A1", business_object=BO_ALPHA, authority=AUTHORITY_BUS_FACTOR_FIRES,
                sla_timing={"time_per_case_min": 180, "volume_per_month": 100},
                verdict={"V": 4, "E": 4, "R": 4, "D": 4, "I": 4, "C": 4, "T": 4},
                verification_method="Deterministic Rule Check",
                dependencies=["external-input"]),
            _wu("WU-A2", business_object=BO_ALPHA, authority=AUTHORITY_BUS_FACTOR_FIRES,
                sla_timing={"time_per_case_min": 180, "volume_per_month": 100},
                verdict={"V": 4, "E": 4, "R": 4, "D": 4, "I": 4, "C": 4, "T": 4},
                verification_method="Manager reviews the output informally",
                dependencies=["WU-A1"]),
            _wu("WU-A3", business_object=BO_ALPHA, authority=AUTHORITY_BUS_FACTOR_FIRES,
                sla_timing={"time_per_case_min": 180, "volume_per_month": 100},
                verdict={"V": 4, "E": 4, "R": 4, "D": 4, "I": 4, "C": 4, "T": 4},
                verification_method="Database Constraint Check",
                dependencies=["WU-A2"]),
            _wu("WU-A4", business_object=BO_ALPHA, authority=AUTHORITY_BUS_FACTOR_FIRES,
                sla_timing={"time_per_case_min": 180, "volume_per_month": 100},
                verdict={"V": 4, "E": 4, "R": 4, "D": 4, "I": 4, "C": 4, "T": 4},
                verification_method="Cross-System Reconciliation",
                dependencies=["WU-A3"]),
            _wu("WU-B1", business_object=BO_BETA, authority=AUTHORITY_BUS_FACTOR_QUIET,
                sla_timing={"time_per_case_min": 10, "volume_per_month": 5},
                verdict={"V": 2, "E": 2, "R": 2, "D": 2, "I": 2, "C": 2, "T": 2},
                verification_method="Deterministic Rule Check",
                dependencies=["external-input"]),
            _wu("WU-B2", business_object=BO_BETA, authority=AUTHORITY_BUS_FACTOR_QUIET,
                sla_timing={"time_per_case_min": 10, "volume_per_month": 5},
                verdict={"V": 2, "E": 2, "R": 2, "D": 2, "I": 2, "C": 2, "T": 2},
                verification_method="Deterministic Rule Check",
                dependencies=["WU-B1"]),
            _wu("WU-B3", business_object=BO_BETA, authority=AUTHORITY_BUS_FACTOR_QUIET,
                sla_timing={"time_per_case_min": 10, "volume_per_month": 5},
                verdict={"V": 2, "E": 2, "R": 2, "D": 2, "I": 2, "C": 2, "T": 2},
                verification_method="Deterministic Rule Check",
                dependencies=["WU-B2"]),
            _wu("WU-B4", business_object=BO_BETA, authority=AUTHORITY_BUS_FACTOR_QUIET,
                sla_timing={"time_per_case_min": 10, "volume_per_month": 5},
                verdict={"V": 2, "E": 2, "R": 2, "D": 2, "I": 2, "C": 2, "T": 2},
                verification_method="Deterministic Rule Check",
                dependencies=["WU-B3"]),
            _wu("WU-C1", business_object="Case Gamma", authority="Solo Authority C1",
                sla_timing={"time_per_case_min": 60},  # volume_per_month absent on purpose
                verdict={"V": 5, "E": 5, "R": 5, "D": 4, "I": 4, "C": 4, "T": 4},
                verification_method="Deterministic Rule Check",
                dependencies=["WU-D1"]),
            _wu("WU-D1", business_object="Case Delta", authority="Solo Authority D1",
                sla_timing={"time_per_case_min": 30, "volume_per_month": 20},
                verdict=None,
                verification_method="Deterministic Rule Check",
                dependencies=["external-input"]),
        ],
    }
    return genome


def _make_tenant(session, slug):
    raw_key = f"test-{slug}-key-" + "a" * 20
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
def imported():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "ai-a")
    key_b, cid_b = _make_tenant(session, "ai-b")
    session.commit()
    session.close()

    from app.main import app
    genome = _build_genome()
    with TestClient(app) as client:
        r = client.post("/api/genome/import", headers={"X-Spec-Key": key_a}, json=deepcopy(genome))
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
def test_response_shape_has_pinned_keys(real_client, imported):
    vid = imported["version_id"]
    r = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_a"]})
    assert r.status_code == 200, r.text
    body = r.json()
    expected_keys = {
        "L1_count", "L2_count", "L3_count", "L4_count", "L5_count", "L6_count",
        "verdict_missing_count", "total_hours_current", "total_hours_saveable",
        "highest_value_targets", "cost_per_verified_unit", "needs_cost_profile",
        "rule_debt_count", "bottleneck_view", "work_graph_summary",
    }
    assert expected_keys.issubset(body.keys())
    for row in body["bottleneck_view"]:
        assert {"authority_redacted", "wu_count", "hours_per_day", "bus_factor_1", "wu_ids"}.issubset(row.keys())
    assert {"sequence_edges", "shared_object_edges", "shared_resource_edges", "reciprocal_edges", "reciprocal_computed"}.issubset(
        body["work_graph_summary"].keys()
    )


@pg_skip
def test_hours_current_and_saveable_only_from_present_fields(real_client, imported):
    vid = imported["version_id"]
    r = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_a"]})
    assert r.status_code == 200, r.text
    body = r.json()

    hours_a = (180 / 60) * 100          # 300 hrs/mo per WU, 4 WUs
    hours_b = (10 / 60) * 5             # 0.8333 hrs/mo per WU, 4 WUs
    hours_d1 = (30 / 60) * 20           # 10 hrs/mo, verdict missing
    expected_current = 4 * hours_a + 4 * hours_b + hours_d1
    expected_saveable = 4 * hours_a     # only Group A: known hours + verdict L4/L5/L6

    assert body["total_hours_current"] == pytest.approx(expected_current, abs=1e-3)
    assert body["total_hours_saveable"] == pytest.approx(expected_saveable, abs=1e-3)
    # WU-C1 has a saveable-eligible verdict (L5) but unknown hours -> omitted, not zeroed in.
    assert "WU-C1" not in body["highest_value_targets"]
    assert set(body["highest_value_targets"]) == {"WU-A1", "WU-A2", "WU-A3", "WU-A4"}
    assert body["cost_per_verified_unit"] is None
    assert body["needs_cost_profile"] is True


@pg_skip
def test_autonomy_counts_and_verdict_missing(real_client, imported):
    vid = imported["version_id"]
    r = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_a"]})
    body = r.json()
    assert body["L4_count"] == 4   # Group A
    assert body["L2_count"] == 4   # Group B
    assert body["L5_count"] == 1   # WU-C1
    assert body["L1_count"] == 0
    assert body["L3_count"] == 0
    assert body["L6_count"] == 0
    assert body["verdict_missing_count"] == 1   # WU-D1 has no verdict block


@pg_skip
def test_rule_debt_count_matches_existing_fallback_heuristic(real_client, imported):
    """Do not invent a second debt definition — recompute from the same
    _map_verification_method fallback genome_import.py already uses."""
    vid = imported["version_id"]
    r = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_a"]})
    body = r.json()
    expected = sum(
        1 for wu in imported["genome"]["work_units"]
        if _map_verification_method(wu["verification_method"]) == VerificationMethod.human_spot_check
    )
    assert expected == 1  # only WU-A2's text matches no keyword
    assert body["rule_debt_count"] == expected


@pg_skip
def test_bus_factor_fires_and_quiet_fixtures_use_named_constants(real_client, imported):
    vid = imported["version_id"]
    r = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_a"]})
    body = r.json()

    rows = {row["authority_redacted"]: row for row in body["bottleneck_view"]}

    fires = rows[redact(AUTHORITY_BUS_FACTOR_FIRES)]
    assert fires["wu_count"] == 4 > BUS_FACTOR_WU_THRESHOLD
    assert fires["hours_per_day"] == pytest.approx((4 * 300) / WORKING_DAYS_PER_MONTH, abs=1e-3)
    assert fires["hours_per_day"] > BUS_FACTOR_HOURS_PER_DAY
    assert fires["bus_factor_1"] is True
    assert set(fires["wu_ids"]) == {"WU-A1", "WU-A2", "WU-A3", "WU-A4"}

    quiet = rows[redact(AUTHORITY_BUS_FACTOR_QUIET)]
    assert quiet["wu_count"] == 4 > BUS_FACTOR_WU_THRESHOLD   # WU-count rule alone is met...
    assert quiet["hours_per_day"] < BUS_FACTOR_HOURS_PER_DAY   # ...but the hours rule is not
    assert quiet["bus_factor_1"] is False


@pg_skip
def test_shared_object_and_shared_resource_edges_created_and_idempotent(real_client, imported):
    vid = imported["version_id"]
    r1 = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_a"]})
    body1 = r1.json()
    summary1 = body1["work_graph_summary"]

    # Case Alpha (4 WUs) and Case Beta (4 WUs) each contribute C(4,2)=6 shared_object edges.
    assert summary1["shared_object_edges"] == 12
    # Only the bus-factor-1 group (Group A, 4 WUs) gets shared_resource edges: C(4,2)=6.
    assert summary1["shared_resource_edges"] == 6
    # Two 3-edge dependency chains (Group A, Group B) plus the one-way C1->D1 edge.
    assert summary1["sequence_edges"] == 7
    assert summary1["reciprocal_edges"] == 0
    assert summary1["reciprocal_computed"] is False

    r2 = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_a"]})
    summary2 = r2.json()["work_graph_summary"]
    assert summary2 == summary1   # second GET must not duplicate any edge


@pg_skip
def test_org_b_gets_404(real_client, imported):
    vid = imported["version_id"]
    r = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": imported["key_b"]})
    assert r.status_code == 404


@pytest.fixture
def fixed_imported():
    session = SetupSession()
    key_a, cid_a = _make_tenant(session, "ai-fixed")
    session.commit()
    session.close()

    with open(SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-FIXED.json", encoding="utf-8") as f:
        genome = json.load(f)
    genome["dual_scoring_kappa"] = 0.85

    from app.main import app
    with TestClient(app) as client:
        r = client.post("/api/genome/import", headers={"X-Spec-Key": key_a}, json=genome)
        assert r.status_code == 201, r.text
        # 92.86, not 94.29 — see the comment on the sequence_edges assertion
        # below for why.
        assert r.json()["gqs"] == 92.86
        version_id = r.json()["version_id"]

    yield {"key_a": key_a, "version_id": version_id}

    session = SetupSession()
    _cleanup(session, [cid_a])
    session.close()


@pg_skip
def test_fixed_sample_hours_honestly_zero_and_sequence_count_unchanged(real_client, fixed_imported):
    """The real FIXED sample's sla_timing only has `raw` free text, never
    structured time_per_case_min/volume_per_month — so hours_current must be
    honestly 0.0, not imputed from anywhere. Sequence edge count (from
    dependencies[], Slice 1 behavior) must be unaffected by THIS test's own
    concern (hours honesty) — it is not asserting the count never changes
    for any reason. It did change once, separately: the fixture used to
    declare four mutually-cyclic dependency pairs (e.g. WU-OFF-02B depends
    on WU-OFF-03 *and* WU-OFF-03 depends on WU-OFF-02B — "B cannot start
    until A completes" cannot honestly hold both ways for the same pair).
    Each pair produced two WorkEdge rows where a real process has exactly
    one order; the Work Graph page rendered the mutual pairs as a tangled,
    unreadable knot. Fixed by removing the backwards half of each pair,
    grounded in each unit's own current_condition/desired_condition/trigger
    (not invented) — see samples/Private-Genome-MVP-HR-Ops-FIXED.json's
    git history and docs/HONESTY.md. 13 -> 9."""
    vid = fixed_imported["version_id"]
    r = real_client.get(f"/api/genome/{vid}/automation-index", headers={"X-Spec-Key": fixed_imported["key_a"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_hours_current"] == 0.0
    assert body["total_hours_saveable"] == 0.0
    assert body["highest_value_targets"] == []
    assert body["work_graph_summary"]["sequence_edges"] == 9
    assert body["verdict_missing_count"] == 0  # every WU in this fixture carries a verdict block
