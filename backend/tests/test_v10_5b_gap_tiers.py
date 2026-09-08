"""V10-5b (docs/NEXT.md; docs/V10_BUILD.md V10-5 "Gap 3 tiers"): one gap
table, three tiers.

  process (Tier 1) -- one desk's own declared-vs-owned work: the three
      gates that already existed (undeclared / split_recommended /
      missing_terminal_state) plus every other pre-V10-5b GapKind. The
      column default, so nothing that already wrote a gap had to change.
  journey (Tier 2) -- the Work System seam no single desk owns: the
      upstream desk hands off to the next desk, or it doesn't.
  outcome (Tier 3) -- promised vs not measured, never invented.

Every tier warns. None of them rejects: GQS is still the only reject, and
the last test in this file holds that line.

The "real import" tests below run the genome this repo actually ships and
CI already imports over HTTP (samples/Private-Genome-MVP-HR-Ops-FIXED.json,
see test_rls_http.py::test_rls_genome_isolation_via_http) rather than a
hand-built payload -- the whole point of the journey tier is whether a real
cross-desk handoff is present in real data, which a fixture written to
contain one would prove nothing about. Where a test needs the journey seam
open, it either drops whole units from that same real file (exactly the
state a tenant is in when the Offer Desk lane has been imported and
Onboarding has not) or repoints a dependency -- and nothing else; see
_real_genome() for the two edits and why they are the only two.

SQLite is enough for the import-level tests -- pure Python/SQLAlchemy
logic, same reasoning as test_gate9_terminal_state.py. The RLS test needs
real Postgres (`SET app.current_client_id` is Postgres-only syntax), same
as test_outcome.py / test_rls_http.py.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.client import Client
from app.models.discovery import (
    TIER_BY_KIND,
    ConformanceGap,
    GapKind,
    GapTier,
    tier_for_kind,
)
from app.models.ontology import EntityKind, EntityType
from app.models.outcome import OutcomeRecord, OutcomeStatus
from app.models.security import OrgApiKey
from app.models.work_system import WorkSystem
from app.models.workunit import WorkUnit
from app.services.genome_import import import_genome
from app.services.work_system import WORK_SYSTEM_DESK_LANES, desk_of

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"
WS_CODE = "WS-OFFER-ONBOARD"
PROMISED = "Candidate handed over, Day-1 ready"


def _real_genome(drop: tuple[str, ...] = (), reroute_deps: tuple[str, ...] = ()) -> dict:
    """The shipped private genome, verbatim, with two allowed edits:

    `drop` removes whole units by code prefix -- the tenant state where one
    lane has been imported and another has not.

    `reroute_deps` repoints a dependency whose code starts with one of the
    given prefixes at "external-input", the same real sentinel this repo's
    own offer-desk genome uses for a step triggered from outside the batch
    (offer-desk-inputs/06-payoff-genome, WU-OD-01). Only the edge moves:
    the dependencies field stays populated, so GQS's completeness score is
    unchanged and the genome still clears the >=90 gate on its own merits
    -- which matters, because a test for "no handoff exists" must not
    accidentally become a test for "GQS rejected it".

    No other attribute of any unit is ever rewritten."""
    with open(SAMPLES_DIR / "Private-Genome-MVP-HR-Ops-FIXED.json", encoding="utf-8") as f:
        genome = json.load(f)
    genome["dual_scoring_kappa"] = 0.85
    genome["work_units"] = [
        unit for unit in genome["work_units"] if not unit["id"].startswith(drop)
    ]
    if reroute_deps:
        for unit in genome["work_units"]:
            unit["dependencies"] = sorted({
                "external-input" if dep.startswith(reroute_deps) else dep
                for dep in unit["dependencies"]
            })
    return genome


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


def _work_system(db, client: Client, *, outcome: str = PROMISED) -> WorkSystem:
    """Nothing seeds a Work System (routers/work_systems.py) -- a tenant has
    one only once the Work Chart page has ensured it, so every test that
    cares about the journey/outcome tiers creates it explicitly."""
    row = WorkSystem(client_id=client.id, code=WS_CODE, name="Offer -> Day-1 ready", outcome=outcome)
    db.add(row)
    db.commit()
    return row


def _seed_unit(db, client: Client, code: str) -> WorkUnit:
    """A Work Unit put in the inventory by a path other than genome import
    -- services/demo.py's HR seed and POST /work-units both do this. Matters
    for the journey tier: such a unit can leave a seam genuinely open with
    no gap yet written for it, which is the only state that tells the
    "this import touched neither desk" restraint apart from the
    "upstream desk is empty" one."""
    entity = db.query(EntityType).filter(EntityType.name == "Seeded Object").one_or_none()
    if entity is None:
        entity = EntityType(
            name="Seeded Object", kind=EntityKind.business_object, description="", state_machine="[]",
        )
        db.add(entity)
        db.flush()
    row = WorkUnit(
        client_id=client.id, code=code, name=f"Seeded {code}",
        business_object_type_id=entity.id, current_condition="a", desired_condition="b",
    )
    db.add(row)
    db.commit()
    return row


def _gaps(db, client_id: int, tier: GapTier | None = None, kind: GapKind | None = None):
    q = db.query(ConformanceGap).filter(ConformanceGap.client_id == client_id)
    if tier is not None:
        q = q.filter(ConformanceGap.tier == tier)
    if kind is not None:
        q = q.filter(ConformanceGap.kind == kind)
    return q.order_by(ConformanceGap.id)


# --------------------------------------------------------------------------
# The tier taxonomy itself
# --------------------------------------------------------------------------

def test_every_gap_kind_has_exactly_one_tier():
    """tier_for_kind is total over GapKind, so no gap can ever be written
    without a tier -- and only the two V10-5b kinds are non-process, which
    is what makes `process` an honest column default for every writer that
    predates this slice."""
    for kind in GapKind:
        assert isinstance(tier_for_kind(kind), GapTier)

    assert tier_for_kind(GapKind.missing_handoff) is GapTier.journey
    assert tier_for_kind(GapKind.outcome_not_measured) is GapTier.outcome
    assert set(TIER_BY_KIND) == {GapKind.missing_handoff, GapKind.outcome_not_measured}
    for kind in set(GapKind) - set(TIER_BY_KIND):
        assert tier_for_kind(kind) is GapTier.process, kind


def test_tier_defaults_to_process_when_no_writer_names_one(db):
    """The additive column's default. A pre-V10-5b writer (here: the plain
    POST /discovery/gaps shape) still produces a correctly-tiered row."""
    client = _tenant(db, "tier-default")
    row = ConformanceGap(kind=GapKind.missing_acceptance, description="x", client_id=client.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    assert row.tier is GapTier.process


def test_desk_of_keeps_offboarding_out_of_the_offer_desk_lane():
    """WU-OFFB-* is Offboarding -- a different desk, explicitly not in this
    Work System. A bare "WU-OFF" prefix test would swallow it and make the
    Offer Desk lane look populated by units that are not in the journey."""
    assert desk_of("WU-OD-02") == "Offer Desk"
    assert desk_of("WU-OD-002") == "Offer Desk"
    assert desk_of("WU-OFF-03") == "Offer Desk"
    assert desk_of("WU-ONB-10") == "Onboarding"
    assert desk_of("WU-OFFB-01") is None
    assert desk_of("WU-HRBP-GR-1") is None
    assert [name for name, _ in WORK_SYSTEM_DESK_LANES] == ["Offer Desk", "Onboarding"]


# --------------------------------------------------------------------------
# Three tiers on a real import
# --------------------------------------------------------------------------

def test_three_tiers_on_one_real_import(db):
    """The headline of this slice. The shipped private genome with its
    Onboarding lane not yet imported -- a real tenant state, not a
    contrivance -- produces all three tiers at once from one import:
    process gaps on individual units, one journey gap for the seam that
    now leads nowhere, one outcome gap for the promise nothing measures."""
    client = _tenant(db, "tiers-real")
    _work_system(db, client)

    result = import_genome(db, client.id, _real_genome(drop=("WU-ONB-",)), actor="test")

    assert result["accepted"] is True, result
    by_tier = result["gaps_by_tier"]
    assert by_tier["process"] > 0
    assert by_tier["journey"] == 1
    assert by_tier["outcome"] == 1
    assert result["missing_handoff_flagged"] == 1
    assert result["outcome_not_measured_flagged"] == 1

    # And the rows themselves carry the tier, not just the result payload.
    persisted = {gap.tier for gap in _gaps(db, client.id)}
    assert persisted == {GapTier.process, GapTier.journey, GapTier.outcome}
    assert _gaps(db, client.id, tier=GapTier.journey).count() == 1
    assert _gaps(db, client.id, tier=GapTier.outcome).count() == 1
    assert by_tier["process"] == _gaps(db, client.id, tier=GapTier.process).count()

    # Every persisted row's tier agrees with its kind -- the column can
    # never say journey about a process finding.
    for gap in _gaps(db, client.id):
        assert gap.tier is tier_for_kind(gap.kind), gap.kind


def test_real_import_with_a_real_handoff_raises_no_journey_gap(db):
    """The same real genome, untouched: WU-ONB-10 declares WU-OFF-04 as a
    dependency, so a real Offer-Desk-to-Onboarding edge exists and the
    journey tier stays silent. The process and outcome tiers are unaffected
    -- proof the journey check reads the seam rather than just counting
    units."""
    client = _tenant(db, "tiers-handoff-present")
    _work_system(db, client)

    result = import_genome(db, client.id, _real_genome(), actor="test")

    assert result["accepted"] is True, result
    assert result["missing_handoff_flagged"] == 0
    assert _gaps(db, client.id, tier=GapTier.journey).count() == 0
    assert result["gaps_by_tier"]["process"] > 0
    assert result["gaps_by_tier"]["outcome"] == 1


def test_journey_gap_when_both_desks_exist_but_nothing_crosses(db):
    """The other half of the journey rule: both lanes are populated from the
    same real genome, but every dependency into the Onboarding units is
    dropped, so no edge crosses the seam. Units on both sides are not a
    handoff."""
    client = _tenant(db, "tiers-no-edge")
    _work_system(db, client)

    result = import_genome(db, client.id, _real_genome(reroute_deps=("WU-OFF-",)), actor="test")

    assert result["accepted"] is True, result
    assert result["missing_handoff_flagged"] == 1
    gap = _gaps(db, client.id, kind=GapKind.missing_handoff).one()
    assert gap.tier is GapTier.journey
    assert gap.severity == "P2"
    assert gap.declared_ref == "Offer Desk -> Onboarding"
    assert gap.work_unit_id is None
    assert "no dependency edge" in gap.description
    assert "was accepted" in gap.description


def test_journey_gap_names_the_empty_next_desk(db):
    client = _tenant(db, "tiers-empty-next-desk")
    _work_system(db, client)

    import_genome(db, client.id, _real_genome(drop=("WU-ONB-",)), actor="test")

    gap = _gaps(db, client.id, kind=GapKind.missing_handoff).one()
    assert "no work units on this tenant at all" in gap.description
    assert "Offer Desk" in gap.description


def test_no_journey_gap_for_an_import_that_touches_neither_desk(db):
    """A genome of units outside this Work System (WU-HRBP-*, WU-OFFB-*,
    WU-US-*) must not produce a verdict on the HR journey -- same restraint
    Gate 9 shows by only evaluating business objects this import touched.

    The seam here is genuinely open and unreported: both lanes are already
    in the inventory from a non-import path, with no edge between them and
    no gap yet written. So this asserts the restraint itself, not one of the
    other guards -- drop the touched-desk check and this import starts
    delivering a verdict on a journey it never looked at."""
    client = _tenant(db, "tiers-untouched")
    _work_system(db, client)
    _seed_unit(db, client, "WU-OD-01")
    _seed_unit(db, client, "WU-ONB-01")

    result = import_genome(
        db, client.id, _real_genome(drop=("WU-OD-", "WU-OFF-", "WU-ONB-")), actor="test",
    )

    assert result["accepted"] is True, result
    assert result["missing_handoff_flagged"] == 0
    assert _gaps(db, client.id, tier=GapTier.journey).count() == 0


def test_no_journey_gap_when_the_upstream_desk_is_empty(db):
    """Onboarding units with no Offer Desk at all is an empty inventory, not
    a broken journey: there is nothing yet to hand off, and calling that a
    seam failure would be inventing a finding."""
    client = _tenant(db, "tiers-no-upstream")
    _work_system(db, client)

    result = import_genome(
        db, client.id, _real_genome(drop=("WU-OD-", "WU-OFF-"), reroute_deps=("WU-OFF-",)),
        actor="test",
    )

    assert result["accepted"] is True, result
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id, WorkUnit.code.startswith("WU-ONB-")).count() > 0
    assert result["missing_handoff_flagged"] == 0
    assert _gaps(db, client.id, tier=GapTier.journey).count() == 0


def test_journey_gap_is_not_duplicated_by_a_second_import(db):
    """The seam is a property of the Work System, not of a batch, so a
    second import must not stack a second identical row on top of it."""
    client = _tenant(db, "tiers-journey-once")
    _work_system(db, client)

    first = import_genome(db, client.id, _real_genome(drop=("WU-ONB-",)), actor="test")
    assert first["missing_handoff_flagged"] == 1

    second_genome = _real_genome(drop=("WU-ONB-",))
    for unit in second_genome["work_units"]:
        unit["id"] = f"{unit['id']}-B"
        unit["dependencies"] = [f"{dep}-B" for dep in unit["dependencies"]]
    second = import_genome(db, client.id, second_genome, actor="test")

    assert second["accepted"] is True, second
    assert second["missing_handoff_flagged"] == 0
    assert _gaps(db, client.id, kind=GapKind.missing_handoff).count() == 1


# --------------------------------------------------------------------------
# Tier 3: promised vs not measured, never invented
# --------------------------------------------------------------------------

def test_outcome_gap_while_not_measured(db):
    """The contract line: a Work System whose outcome_records row says
    not_measured gets one outcome gap. The gap quotes only the tenant's own
    declared promise and states that nothing measured backs it."""
    client = _tenant(db, "outcome-not-measured")
    ws = _work_system(db, client)
    db.add(OutcomeRecord(work_system_id=ws.id, promised=PROMISED, status=OutcomeStatus.not_measured))
    db.commit()

    result = import_genome(db, client.id, _real_genome(), actor="test")

    assert result["accepted"] is True, result
    assert result["outcome_not_measured_flagged"] == 1
    gap = _gaps(db, client.id, kind=GapKind.outcome_not_measured).one()
    assert gap.tier is GapTier.outcome
    assert gap.severity == "P2"
    assert gap.declared_ref == WS_CODE
    assert gap.work_unit_id is None
    assert PROMISED in gap.description
    assert "not_measured" in gap.description
    assert "nothing measured" in gap.description


def test_outcome_gap_treats_a_missing_record_as_not_measured(db):
    """A Work System with no outcome_records row makes exactly the claim a
    not_measured row makes (services/outcome.py::get_or_create vivifies that
    default on first read), so it is warned the same way -- and reading a
    genome must not write the row itself."""
    client = _tenant(db, "outcome-no-record")
    _work_system(db, client)

    result = import_genome(db, client.id, _real_genome(), actor="test")

    assert result["outcome_not_measured_flagged"] == 1
    assert "has no outcome record yet" in _gaps(db, client.id, kind=GapKind.outcome_not_measured).one().description
    assert db.query(OutcomeRecord).count() == 0


def test_no_outcome_gap_once_a_real_measurement_exists(db):
    """The gap closes on a real measurement -- one a caller stated through
    PUT /work-systems/{id}/outcome, which services/outcome.py only accepts
    with a number and a named source. Import never sets this itself."""
    client = _tenant(db, "outcome-measured")
    ws = _work_system(db, client)
    db.add(OutcomeRecord(
        work_system_id=ws.id, promised=PROMISED,
        measured="58% Day-1 ready (source: Payroll export, Sep 2026)",
        status=OutcomeStatus.measured,
    ))
    db.commit()

    result = import_genome(db, client.id, _real_genome(), actor="test")

    assert result["accepted"] is True, result
    assert result["outcome_not_measured_flagged"] == 0
    assert _gaps(db, client.id, tier=GapTier.outcome).count() == 0


def test_import_never_invents_a_measured_outcome(db):
    """"Never invent measured KPIs" (docs/NEXT.md), asserted on the data
    rather than trusted: after an import that raised the outcome gap, the
    record is still not_measured with measured null. The gap is the honest
    substitute for a number, not a step towards one."""
    client = _tenant(db, "outcome-never-invented")
    ws = _work_system(db, client)
    db.add(OutcomeRecord(work_system_id=ws.id, promised=PROMISED, status=OutcomeStatus.not_measured))
    db.commit()

    import_genome(db, client.id, _real_genome(), actor="test")

    record = db.query(OutcomeRecord).filter(OutcomeRecord.work_system_id == ws.id).one()
    assert record.status is OutcomeStatus.not_measured
    assert record.measured is None
    assert record.promised == PROMISED


def test_no_outcome_gap_when_the_tenant_has_no_work_system(db):
    """Nothing seeds a Work System, so a tenant that has not ensured one has
    promised nothing -- there is no promise to be unmeasured, and inventing
    a gap here would be inventing the promise too."""
    client = _tenant(db, "outcome-no-work-system")

    result = import_genome(db, client.id, _real_genome(), actor="test")

    assert result["accepted"] is True, result
    assert result["outcome_not_measured_flagged"] == 0
    assert _gaps(db, client.id, tier=GapTier.outcome).count() == 0


def test_outcome_gap_is_not_duplicated_by_a_second_import(db):
    client = _tenant(db, "outcome-once")
    _work_system(db, client)

    first = import_genome(db, client.id, _real_genome(), actor="test")
    assert first["outcome_not_measured_flagged"] == 1

    second_genome = _real_genome()
    for unit in second_genome["work_units"]:
        unit["id"] = f"{unit['id']}-B"
        unit["dependencies"] = [f"{dep}-B" for dep in unit["dependencies"]]
    second = import_genome(db, client.id, second_genome, actor="test")

    assert second["accepted"] is True, second
    assert second["outcome_not_measured_flagged"] == 0
    assert _gaps(db, client.id, kind=GapKind.outcome_not_measured).count() == 1


def test_outcome_gap_is_per_work_system_not_per_import(db):
    """Two Work Systems, two promises, two gaps -- the "one gap" rule is one
    per unmeasured promise, not one per tenant."""
    client = _tenant(db, "outcome-two-systems")
    _work_system(db, client)
    db.add(WorkSystem(client_id=client.id, code="WS-OFFBOARD", name="Offboarding", outcome="Cleared and settled"))
    db.commit()

    result = import_genome(db, client.id, _real_genome(), actor="test")

    assert result["outcome_not_measured_flagged"] == 2
    refs = {gap.declared_ref for gap in _gaps(db, client.id, tier=GapTier.outcome)}
    assert refs == {WS_CODE, "WS-OFFBOARD"}


# --------------------------------------------------------------------------
# GQS is still the only reject
# --------------------------------------------------------------------------

def _declared_only_genome() -> dict:
    """GQS weights Observed% at 40% of the score (services/gqs.py), so an
    all-declared payload caps at 60 and cannot clear the >=90 gate -- the
    same ceiling test_gate10_conformance_gap.py's docstring names."""
    genome = _real_genome(drop=("WU-ONB-",))
    for unit in genome["work_units"]:
        unit["provenance"] = {"source_type": "declared"}
    return genome


def test_gqs_is_still_the_reject_and_no_tier_is_written(db):
    """None of the three tiers is a gate. A genome that fails GQS is
    rejected before any tier runs, and writes no gap of any tier -- not even
    the outcome gap, which does not depend on this batch's units at all."""
    client = _tenant(db, "tiers-gqs-reject")
    _work_system(db, client)

    result = import_genome(db, client.id, _declared_only_genome(), actor="test")

    assert result["accepted"] is False, result
    assert result["gqs"] < 90
    assert "gaps_by_tier" not in result
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 0
    assert _gaps(db, client.id).count() == 0


def test_all_three_tiers_are_warnings_not_rejects(db):
    """Restated on the accepted path: the import that raises all three tiers
    is still accepted, still writes its Work Units, and still reports no
    violations."""
    client = _tenant(db, "tiers-warn-only")
    _work_system(db, client)

    result = import_genome(db, client.id, _real_genome(drop=("WU-ONB-",)), actor="test")

    assert result["accepted"] is True
    assert result["violations"] == []
    assert result["work_unit_count"] == db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count()
    assert sum(result["gaps_by_tier"].values()) > 0


# --------------------------------------------------------------------------
# RLS: a tier is as tenant-isolated as the gap carrying it
# --------------------------------------------------------------------------

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


def _make_pg_tenant(session, slug):
    raw_key = f"test-{slug}-key-" + "r" * 20
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


def _pg_cleanup(session, client_ids):
    ids = {"ids": client_ids}
    for table in (
        "work_unit_provenance", "work_unit_regulatory_links", "pii_field_values",
        "verdict_scores", "cost_profiles", "verification_runs", "autonomy_changes",
        "spec_checks", "trajectories", "ratifications",
    ):
        session.execute(text(
            f"DELETE FROM {table} WHERE work_unit_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
        ), ids)
    session.execute(text(
        "DELETE FROM work_unit_variants WHERE parent_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text(
        "DELETE FROM work_edges WHERE source_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids)) "
        "OR target_id IN (SELECT id FROM work_units WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM conformance_gaps WHERE client_id = ANY(:ids)"), ids)
    session.execute(text(
        "DELETE FROM outcome_records WHERE work_system_id IN (SELECT id FROM work_systems WHERE client_id = ANY(:ids))"
    ), ids)
    session.execute(text("DELETE FROM work_systems WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("UPDATE work_units SET genome_version_id = NULL WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM work_units WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM audit_logs WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM genome_versions WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM org_api_keys WHERE client_id = ANY(:ids)"), ids)
    session.execute(text("DELETE FROM clients WHERE id = ANY(:ids)"), ids)
    session.commit()


@pytest.fixture
def real_client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture
def two_tenants():
    session = SetupSession()
    key_a, cid_a = _make_pg_tenant(session, "tier-a")
    key_b, cid_b = _make_pg_tenant(session, "tier-b")
    session.commit()
    session.close()

    yield {
        "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a},
        "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b},
    }

    session = SetupSession()
    _pg_cleanup(session, [cid_a, cid_b])
    session.close()


@pg_skip
def test_rls_gap_tiers_are_tenant_isolated_via_http(real_client, two_tenants):
    """A tier is only as private as the gap carrying it. Tenant A imports a
    real genome that raises all three tiers; tenant B sees none of them --
    not a redacted count, nothing -- through the same tier-filtered
    endpoint, on the shared conformance_gaps table under RLS."""
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]

    ensured = real_client.post("/api/work-systems", headers=headers_a, json={
        "code": WS_CODE,
        "name": "Recruiter asks for offer -> offer released -> Day-1 ready",
        "entry": "Recruiter sends offer request",
        "exit": "New hire fully onboarded",
        "owner": "Head of HR operations (stand-in)",
        "outcome": PROMISED,
    })
    assert ensured.status_code == 201, ensured.text

    imported = real_client.post("/api/genome/import", headers=headers_a, json=_real_genome(drop=("WU-ONB-",)))
    assert imported.status_code == 201, imported.text
    body = imported.json()
    assert body["accepted"] is True
    assert body["gaps_by_tier"]["journey"] == 1
    assert body["gaps_by_tier"]["outcome"] == 1

    for tier in ("process", "journey", "outcome"):
        own = real_client.get(f"/api/discovery/gaps?tier={tier}", headers=headers_a)
        assert own.status_code == 200, own.text
        assert own.json()["total"] > 0, tier
        assert {row["tier"] for row in own.json()["items"]} == {tier}

        other = real_client.get(f"/api/discovery/gaps?tier={tier}", headers=headers_b)
        assert other.status_code == 200, other.text
        assert other.json()["total"] == 0, tier
        assert other.json()["items"] == []

    # Unfiltered, A still sees all three tiers and B still sees none of A's.
    all_a = real_client.get("/api/discovery/gaps", headers=headers_a).json()
    assert {row["tier"] for row in all_a["items"]} == {"process", "journey", "outcome"}
    assert all(row["client_id"] == two_tenants["client_a_id"] for row in all_a["items"])
    assert real_client.get("/api/discovery/gaps", headers=headers_b).json()["total"] == 0
