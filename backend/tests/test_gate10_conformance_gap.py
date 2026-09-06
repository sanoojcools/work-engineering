"""Track 1 slice 1.1 (docs/BUILD_PROGRAM.md, Gate 10 per
docs/ROADMAP-DECISIONS.md): at genome import, a declared Work Unit with no
corroborating observed Work Unit for the same business object gets a
ConformanceGap (kind=undeclared, severity=P2) -- a warning, never a reject.
An observed twin for that business object means no gap. Scout's own
generate-genome path still has to clear GQS first, same as before this
slice -- this does not open a side door around it.

work_units.code is UNIQUE per client (see genome_import.py's
_validate_work_unit_codes), so "twin" can never mean two rows sharing the
same literal code -- that collision is a hard reject long before Gate 10
runs. The only real, checkable corroboration is business_object: does this
client have any observed-provenance Work Unit for the same business object,
from this import or an earlier one.

GQS itself weights Observed% at 40% of the score (services/gqs.py), so a
payload that is 100% declared cannot clear the >=90 gate on its own (it
caps at 60) -- that's the same ceiling test_scout_consent_gate.py's
docstring names for Scout's own capture. Every fixture below that expects
`accepted: True` therefore carries enough real observed filler units
(a plain 4-observed-to-1-other ratio, 80% observed, scores 92) to clear GQS
independently of Gate 10 -- Gate 10 is then read off the *declared* unit(s)
among that batch, which is the thing this slice actually gates.

SQLite is enough: this is pure Python/SQLAlchemy logic, same reasoning as
test_genome_import_cycles.py and test_scout_consent_gate.py.
"""
from __future__ import annotations

import hashlib

from app.models.client import Client
from app.models.discovery import ConformanceGap, GapKind
from app.models.scout import InterviewStatus, ScoutCapturedUnit, ScoutInterviewSession
from app.models.security import OrgApiKey
from app.models.workunit import WorkUnit
from app.services.genome_import import import_genome
from app.services.scout_genome import build_genome_payload, generate_genome


def _wu(code: str, *, business_object: str, source_type: str) -> dict:
    return {
        "id": code,
        "name": f"Do the thing {code}",
        "business_object": business_object,
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
        "dependencies": ["external-input"],
        "failure_semantics": "hold and notify",
        "regulatory_register_link": ["RR-001"],
        "provenance": {"source_type": source_type, "hash_sha256": "a" * 64},
    }


def _filler(prefix: str, n: int = 4, business_object: str | None = None) -> list[dict]:
    """n observed Work Units -- pushes a payload's Observed% high enough
    (80% at the default 4-filler-to-1 ratio used throughout this file) to
    clear GQS's >=90 gate on its own, independent of whatever declared/
    inferred/designed unit the test under it is actually exercising."""
    return [
        _wu(f"WU-{prefix}-FILL{i}", business_object=business_object or f"Filler-{prefix}-{i}", source_type="observed")
        for i in range(n)
    ]


def _genome(work_units: list[dict]) -> dict:
    return {"work_units": work_units, "dual_scoring_kappa": 0.85}


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


def test_declared_only_import_creates_undeclared_gap(db):
    """A declared Work Unit with no observed corroboration anywhere for its
    business object gets a P2 undeclared gap -- and the import still
    succeeds (warn, not reject)."""
    client = _tenant(db, "gate10-declared-only")
    genome = _genome(_filler("A") + [_wu("WU-G1", business_object="Offer", source_type="declared")])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["conformance_gaps_flagged"] == 1
    wu = db.query(WorkUnit).filter(WorkUnit.client_id == client.id, WorkUnit.code == "WU-G1").one()
    assert wu.provenance.value == "declared"
    gap = db.query(ConformanceGap).filter(ConformanceGap.client_id == client.id).one()
    assert gap.kind == GapKind.undeclared
    assert gap.severity == "P2"
    assert gap.declared_ref == "WU-G1"
    assert gap.work_unit_id == wu.id


def test_observed_twin_present_no_gap(db):
    """Same business object, one declared unit and one observed unit in the
    same import -- the declared unit has a twin, so no gap for it."""
    client = _tenant(db, "gate10-twin")
    genome = _genome(_filler("B") + [
        _wu("WU-G2-DECL", business_object="Offer", source_type="declared"),
        _wu("WU-G2-OBS", business_object="Offer", source_type="observed"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["conformance_gaps_flagged"] == 0
    assert db.query(ConformanceGap).filter(ConformanceGap.client_id == client.id).count() == 0


def test_observed_twin_must_match_the_same_business_object(db):
    """An observed unit for a DIFFERENT business object does not corroborate
    a declared unit -- the gap still fires."""
    client = _tenant(db, "gate10-mismatched-bo")
    genome = _genome(_filler("C") + [
        _wu("WU-G3-DECL", business_object="Offer", source_type="declared"),
        _wu("WU-G3-OBS", business_object="Employee", source_type="observed"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["conformance_gaps_flagged"] == 1
    gap = db.query(ConformanceGap).filter(ConformanceGap.client_id == client.id).one()
    assert gap.declared_ref == "WU-G3-DECL"


def test_observed_twin_from_an_earlier_import_still_counts(db):
    """The twin doesn't have to be in the same payload -- an observed unit
    already on record for this client's business object from an earlier
    genome version corroborates a new declared unit too."""
    client = _tenant(db, "gate10-earlier-version")
    first = import_genome(
        db, client.id,
        _genome([_wu("WU-G4-OBS", business_object="Payroll", source_type="observed")]),
        actor="test",
    )
    assert first["accepted"] is True, first

    second = import_genome(
        db, client.id,
        _genome(_filler("D") + [_wu("WU-G4-DECL", business_object="Payroll", source_type="declared")]),
        actor="test",
    )

    assert second["accepted"] is True, second
    assert second["conformance_gaps_flagged"] == 0


def test_inferred_and_designed_provenance_are_not_gated(db):
    """Gate 10's frozen contract names 'declared' specifically -- inferred
    and designed units are a different claim and are out of scope here."""
    client = _tenant(db, "gate10-inferred")
    genome = _genome(_filler("E", n=8) + [
        _wu("WU-G5-INF", business_object="Employee", source_type="inferred"),
        _wu("WU-G5-DES", business_object="Employee", source_type="designed"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["conformance_gaps_flagged"] == 0


def test_gap_is_scoped_per_client(db):
    """Client B's observed Work Unit must not corroborate Client A's
    declared one -- the check is client-scoped, independent of RLS."""
    client_a = _tenant(db, "gate10-tenant-a")
    client_b = _tenant(db, "gate10-tenant-b")
    import_genome(
        db, client_b.id,
        _genome([_wu("WU-G6-OBS", business_object="Offer", source_type="observed")]),
        actor="test",
    )

    result = import_genome(
        db, client_a.id,
        _genome(_filler("F") + [_wu("WU-G6-DECL", business_object="Offer", source_type="declared")]),
        actor="test",
    )

    assert result["accepted"] is True, result
    assert result["conformance_gaps_flagged"] == 1


def _scout_session(db, client: Client) -> ScoutInterviewSession:
    session = ScoutInterviewSession(client_id=client.id, interviewee_name="Anjali", status=InterviewStatus.completed)
    db.add(session)
    db.flush()
    db.add(ScoutCapturedUnit(
        session_id=session.id, client_id=client.id, name="Approve offer",
        inputs="candidate id, offer terms", outputs="signed offer",
        systems="ATS", frequency="daily", time_minutes=20, pain="manual chasing",
        handoffs="Recruiter -> HRBP", decision_rule="Offer within band",
    ))
    db.commit()
    db.refresh(session)
    return session


def test_scout_payload_is_always_declared_never_observed(db):
    """Scout's own genome payload -- the wire shape generate_genome sends
    into import_genome -- must never claim 'observed'. It is a talk-only,
    self-reported capture, and labelling it observed would be exactly the
    kind of fabricated-pack-as-real-evidence non-negotiable #3 forbids."""
    client = _tenant(db, "gate10-scout-shape")
    session = _scout_session(db, client)

    payload = build_genome_payload(session)

    assert payload["work_units"], payload
    for wu in payload["work_units"]:
        assert wu["provenance"]["source_type"] == "declared"


def test_scout_generate_genome_still_blocked_by_gqs_and_never_persists_observed(db):
    """Scout capture never records dependencies (the Work Capture Grid has
    no field for it) and is always declared-provenance -- so it cannot
    clear GQS's >=90 gate today (see test_scout_consent_gate.py's own
    docstring: 'an 8-unit, 100%-complete session scores GQS 30'). Gate 10
    must not change that outcome or open a path where Scout's output ends
    up persisted as observed to dodge the new gap check."""
    client = _tenant(db, "gate10-scout-gqs")
    session = _scout_session(db, client)

    result = generate_genome(db, session, actor="test")

    assert result["accepted"] is False, result
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 0
    assert db.query(WorkUnit).filter(
        WorkUnit.client_id == client.id, WorkUnit.provenance == "observed"
    ).count() == 0
