"""Track 1 slice 1.3 (docs/BUILD_PROGRAM.md, Gate 9 per
docs/ROADMAP-DECISIONS.md): at genome import, infer a business-object
state graph from the current_condition -> desired_condition transitions of
every Work Unit sharing that business object, cumulative across the
client's Work Units (not just this import) -- same corroboration scope as
Gate 10. A "terminal state" is a desired_condition that is never any other
unit's current_condition for the same business object -- a sink the graph
flows into and never out of. A business object backed by fewer than 3
Work Units is exempt; one with >=3 and no terminal state gets a
ConformanceGap (kind=missing_terminal_state, severity=P2) -- a warning,
never a reject, and entity_types.state_machine is never written (no
auto-fix of the state machine). Reuses the same ConformanceGap table Gate
6/Gate 10 already write to, rather than a second warnings table.

Same GQS-filler shape as test_gate6_split_recommended.py /
test_gate10_conformance_gap.py: a payload that is mostly the "clean"
filler units clears GQS's >=90 gate on its own, so Gate 9 is read off the
specific business object under test rather than being confounded by a GQS
rejection. SQLite is enough, same reasoning as those files.
"""
from __future__ import annotations

import hashlib

from app.models.client import Client
from app.models.discovery import ConformanceGap, GapKind
from app.models.scout import InterviewStatus, ScoutCapturedUnit, ScoutInterviewSession
from app.models.security import OrgApiKey
from app.models.workunit import WorkUnit
from app.services.genome_import import import_genome
from app.services.scout_genome import generate_genome


def _wu(
    code: str,
    *,
    business_object: str = "Offer",
    current_condition: str = "requested",
    desired_condition: str = "done",
) -> dict:
    return {
        "id": code,
        "name": f"Do the thing {code}",
        "business_object": business_object,
        "current_condition": current_condition,
        "desired_condition": desired_condition,
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
        "provenance": {"source_type": "observed", "hash_sha256": "a" * 64},
    }


def _filler(prefix: str, n: int = 4) -> list[dict]:
    return [_wu(f"WU-{prefix}-FILL{i}", business_object=f"Filler-{prefix}-{i}") for i in range(n)]


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


def _missing_terminal_gaps(db, client_id: int):
    return db.query(ConformanceGap).filter(
        ConformanceGap.client_id == client_id, ConformanceGap.kind == GapKind.missing_terminal_state
    )


def test_three_unit_bo_with_no_sink_warns_but_is_still_accepted(db):
    """A 3-unit BO whose current/desired conditions form a closed cycle
    (requested -> approved -> issued -> requested) has no state that is
    never also a current_condition -- no terminal state -- and gets warned."""
    client = _tenant(db, "gate9-cycle")
    genome = _genome(_filler("A") + [
        _wu("WU-T1", business_object="Retention Case", current_condition="requested", desired_condition="approved"),
        _wu("WU-T2", business_object="Retention Case", current_condition="approved", desired_condition="issued"),
        _wu("WU-T3", business_object="Retention Case", current_condition="issued", desired_condition="requested"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["missing_terminal_state_flagged"] == 1
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 4 + 3
    gap = _missing_terminal_gaps(db, client.id).one()
    assert gap.severity == "P2"
    assert gap.declared_ref == "Retention Case"
    assert gap.work_unit_id is None
    assert "terminal state" in gap.description
    assert "Retention Case" in gap.description


def test_three_unit_bo_with_a_sink_has_no_warning(db):
    """Same 3-unit BO shape, but the last unit's desired_condition ('closed')
    is never any unit's current_condition -- a real terminal state -- so no
    gap is created."""
    client = _tenant(db, "gate9-sink")
    genome = _genome(_filler("B") + [
        _wu("WU-T4", business_object="Retention Case", current_condition="requested", desired_condition="approved"),
        _wu("WU-T5", business_object="Retention Case", current_condition="approved", desired_condition="issued"),
        _wu("WU-T6", business_object="Retention Case", current_condition="issued", desired_condition="closed"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["missing_terminal_state_flagged"] == 0
    assert _missing_terminal_gaps(db, client.id).count() == 0


def test_two_unit_bo_is_exempt_even_with_no_sink(db):
    """A 2-unit BO forming the same kind of closed cycle (requested ->
    approved -> requested) would have no terminal state either, but 2-unit
    business objects are exempt from Gate 9 -- too small a sample."""
    client = _tenant(db, "gate9-two-unit")
    genome = _genome(_filler("C") + [
        _wu("WU-T7", business_object="Retention Case", current_condition="requested", desired_condition="approved"),
        _wu("WU-T8", business_object="Retention Case", current_condition="approved", desired_condition="requested"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["missing_terminal_state_flagged"] == 0
    assert _missing_terminal_gaps(db, client.id).count() == 0


def test_no_state_machine_written_by_the_warning(db):
    """Gate 9 only warns -- it must never populate entity_types.state_machine
    itself (no auto-fix)."""
    from app.models.ontology import EntityType

    client = _tenant(db, "gate9-no-autofix")
    genome = _genome(_filler("E") + [
        _wu("WU-T9", business_object="Retention Case", current_condition="requested", desired_condition="approved"),
        _wu("WU-T10", business_object="Retention Case", current_condition="approved", desired_condition="issued"),
        _wu("WU-T11", business_object="Retention Case", current_condition="issued", desired_condition="requested"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["missing_terminal_state_flagged"] == 1
    entity = db.query(EntityType).filter(EntityType.name == "Retention Case").one()
    assert entity.state_machine == "[]"


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


def test_scout_generate_genome_still_blocked_by_gqs_unchanged_by_gate9(db):
    """Gate 9 must not change Scout's existing GQS outcome: an 8-unit,
    100%-complete Scout session still scores below the >=90 gate and is
    still rejected before Gate 9 (or Gate 6/10) ever runs -- same as
    test_gate6_split_recommended.py's equivalent assertion."""
    client = _tenant(db, "gate9-scout-gqs")
    session = _scout_session(db, client)

    result = generate_genome(db, session, actor="test")

    assert result["accepted"] is False, result
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 0
    assert _missing_terminal_gaps(db, client.id).count() == 0
