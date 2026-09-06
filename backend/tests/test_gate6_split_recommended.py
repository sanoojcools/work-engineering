"""Track 1 slice 1.2 (docs/BUILD_PROGRAM.md, Gate 6 per
docs/ROADMAP-DECISIONS.md): at genome import, a Work Unit whose
business_object contains a multi-object delimiter (comma, slash, "and") OR
whose authority names more than one distinct approver gets a
ConformanceGap (kind=split_recommended, severity=P2) -- a warning, never a
reject, and the unit is never auto-split. Reuses the same ConformanceGap
table Gate 10 (test_gate10_conformance_gap.py) already writes to, rather
than a second warnings table.

Same GQS-filler shape as test_gate10_conformance_gap.py: a payload that is
mostly the "clean" filler units clears GQS's >=90 gate on its own, so Gate
6 is read off the specific unit(s) under test rather than being confounded
by a GQS rejection. SQLite is enough, same reasoning as that file.
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


def _wu(code: str, *, business_object: str = "Offer", authority: str = "HR Ops") -> dict:
    return {
        "id": code,
        "name": f"Do the thing {code}",
        "business_object": business_object,
        "current_condition": "requested",
        "desired_condition": "done",
        "context": {"decision_branches": "none", "variants": []},
        "trigger": "a request arrives",
        "input": ["a form"],
        "authority": authority,
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


def test_multi_object_business_object_warns_but_is_still_accepted(db):
    """business_object with a comma-separated multi-object delimiter gets a
    split_recommended gap -- the import is still accepted, and the unit is
    not rejected or auto-split."""
    client = _tenant(db, "gate6-multi-bo-comma")
    genome = _genome(_filler("A") + [_wu("WU-S1", business_object="Offer, Employee")])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["split_recommended_flagged"] == 1
    wu = db.query(WorkUnit).filter(WorkUnit.client_id == client.id, WorkUnit.code == "WU-S1").one()
    assert wu.business_object_type_id is not None  # not split into two units
    gap = db.query(ConformanceGap).filter(
        ConformanceGap.client_id == client.id, ConformanceGap.kind == GapKind.split_recommended
    ).one()
    assert gap.severity == "P2"
    assert gap.declared_ref == "WU-S1"
    assert gap.work_unit_id == wu.id
    assert "business_object" in gap.description


def test_multi_object_business_object_slash_and_and_also_warn(db):
    """The slash and "and" delimiters trigger the same warning as comma."""
    client = _tenant(db, "gate6-multi-bo-slash-and")
    genome = _genome(_filler("B") + [
        _wu("WU-S2-SLASH", business_object="Payroll/Benefits"),
        _wu("WU-S2-AND", business_object="Payroll and Benefits"),
    ])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["split_recommended_flagged"] == 2


def test_multi_approver_authority_warns_but_is_still_accepted(db):
    """authority naming more than one distinct approver also triggers the
    warning, independent of business_object."""
    client = _tenant(db, "gate6-multi-authority")
    genome = _genome(_filler("C") + [_wu("WU-S3", authority="HR Ops and Finance")])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["split_recommended_flagged"] == 1
    gap = db.query(ConformanceGap).filter(
        ConformanceGap.client_id == client.id, ConformanceGap.kind == GapKind.split_recommended
    ).one()
    assert "authority" in gap.description


def test_clean_business_object_and_authority_no_warning(db):
    """A single business_object and a single-approver authority -- no gap,
    same shape as every filler unit."""
    client = _tenant(db, "gate6-clean")
    genome = _genome(_filler("D") + [_wu("WU-S4", business_object="Offer", authority="HR Ops")])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert result["split_recommended_flagged"] == 0
    assert db.query(ConformanceGap).filter(
        ConformanceGap.client_id == client.id, ConformanceGap.kind == GapKind.split_recommended
    ).count() == 0


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


def test_scout_generate_genome_still_blocked_by_gqs_unchanged_by_gate6(db):
    """Gate 6 must not change Scout's existing GQS outcome: an 8-unit,
    100%-complete Scout session still scores below the >=90 gate and is
    still rejected before Gate 6 (or Gate 10) ever runs -- same as
    test_gate10_conformance_gap.py's equivalent assertion."""
    client = _tenant(db, "gate6-scout-gqs")
    session = _scout_session(db, client)

    result = generate_genome(db, session, actor="test")

    assert result["accepted"] is False, result
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 0
    assert db.query(ConformanceGap).filter(ConformanceGap.client_id == client.id).count() == 0
