"""Track 3 of the enterprise-readiness roadmap ("make the spec trustworthy"):
GQS's own completeness check validates that a dependency reference exists,
not that the graph those references form is acyclic -- see
docs/Work-Engineering-V8.md Part K11. A real cycle reached this exact
codebase once (samples/Private-Genome-MVP-HR-Ops-FIXED.json used to declare
two work units as each other's dependency; see docs/HONESTY.md).
_detect_dependency_cycles (services/genome_import.py) closes that gap as a
pre-pass check, same shape as _validate_file_provenance/_validate_work_unit_codes.

SQLite is enough here: cycle detection is pure, in-memory graph logic over
the parsed payload, no RLS or Postgres-specific behavior involved.
"""
from __future__ import annotations

import hashlib

from app.models.client import Client
from app.models.security import OrgApiKey, GenomeVersion
from app.models.workunit import WorkUnit
from app.services.genome_import import import_genome


def _wu(code: str, dependencies: list[str]) -> dict:
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
        "dependencies": dependencies,
        "failure_semantics": "hold and notify",
        "regulatory_register_link": ["RR-001"],
        "provenance": {"source_type": "observed", "hash_sha256": "a" * 64},
    }


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


def test_two_node_mutual_dependency_is_rejected(db):
    """The exact shape the real sample genome had: A depends on B and B
    depends on A. 'B cannot start until A completes' cannot honestly hold
    both ways for the same pair."""
    client = _tenant(db, "cycle-two")
    genome = _genome([
        _wu("WU-X1", ["WU-X2"]),
        _wu("WU-X2", ["WU-X1"]),
    ])
    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is False
    codes = {v["code"] for v in result["violations"]}
    assert "circular_dependency" in codes
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 0


def test_four_node_ring_is_rejected(db):
    client = _tenant(db, "cycle-four")
    genome = _genome([
        _wu("WU-R1", ["WU-R4"]),
        _wu("WU-R2", ["WU-R1"]),
        _wu("WU-R3", ["WU-R2"]),
        _wu("WU-R4", ["WU-R3"]),
    ])
    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is False
    violation = next(v for v in result["violations"] if v["code"] == "circular_dependency")
    # All four ids appear in the reported cycle path -- a human can act on
    # this without re-deriving the graph themselves.
    for code in ("WU-R1", "WU-R2", "WU-R3", "WU-R4"):
        assert code in violation["detail"]


def test_self_dependency_is_rejected(db):
    """A one-node cycle: a work unit naming itself as its own dependency."""
    client = _tenant(db, "cycle-self")
    genome = _genome([_wu("WU-S1", ["WU-S1"])])
    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is False
    assert any(v["code"] == "circular_dependency" for v in result["violations"])


def test_valid_chain_is_not_flagged_as_a_cycle(db):
    """A -> B -> C, a real, legitimate dependency order, must import cleanly
    -- the check must not fire on ordinary DAGs, only genuine cycles."""
    client = _tenant(db, "cycle-chain")
    genome = _genome([
        _wu("WU-C1", ["external-input"]),
        _wu("WU-C2", ["WU-C1"]),
        _wu("WU-C3", ["WU-C2"]),
    ])
    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 3


def test_dependency_outside_this_payload_is_not_treated_as_a_cycle(db):
    """A dependency naming a code not present in this batch is out of scope
    for cycle detection here -- same exclusion _write_genome's own edge
    -creation loop already applies (source=None is skipped), not something
    this check should second-guess."""
    client = _tenant(db, "cycle-external")
    genome = _genome([_wu("WU-E1", ["WU-NOT-IN-THIS-BATCH"])])
    result = import_genome(db, client.id, genome, actor="test")

    # Rejected by GQS's own orphan_dependency check (a WU-shaped token that
    # doesn't resolve within the batch) -- not by circular_dependency. The
    # point of this test is only that "circular_dependency" never fires here.
    assert not any(v["code"] == "circular_dependency" for v in result["violations"])


def test_blocked_by_cycle_still_leaves_an_auditable_version_row(db):
    """Same discipline as every other pre-pass gate in this module: a
    rejected import is recorded, not silently discarded."""
    client = _tenant(db, "cycle-audit")
    genome = _genome([
        _wu("WU-AU1", ["WU-AU2"]),
        _wu("WU-AU2", ["WU-AU1"]),
    ])
    import_genome(db, client.id, genome, actor="test")

    version = db.query(GenomeVersion).filter(GenomeVersion.client_id == client.id).one()
    assert version.gates_passed == "[]"
    assert "circular_dependency" in version.gates_failed
