"""Regression cover for two genome-import defects found by running the real
demo end to end:

1. A genome whose work unit ids already exist for the tenant hit the
   UNIQUE (client_id, code) constraint mid-insert and surfaced as a bare 500
   with no violation list. Reachable in the ordinary demo path, because
   samples/Private-Genome-MVP-HR-Ops-FIXED.json and the Client A HR seed
   both define WU-OFF-03.
2. That same failure was not atomic: the work units written before the
   collision stayed in the database, attached to a version row that still
   claimed the full count, so the failed import poisoned every retry.

SQLite is enough here — neither behaviour depends on RLS, and the unique
constraint is declared on the model.
"""
from __future__ import annotations

from app.models.client import Client
from app.models.security import GenomeVersion, OrgApiKey
from app.models.workunit import WorkUnit
from app.services.genome_import import import_genome

import hashlib


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
        # Non-empty and resolvable within this batch: gqs._wu_is_complete
        # treats [] as a missing attribute, and an unresolvable id is an
        # orphan_dependency violation — either one blocks the batch at the
        # GQS gate, short of the write phase these tests are about.
        "dependencies": [depends_on],
        "failure_semantics": "hold and notify",
        "regulatory_register_link": ["RR-001"],
        "provenance": {"source_type": "observed", "hash_sha256": "a" * 64},
    }


def _genome(codes: list[str]) -> dict:
    anchor = codes[0]
    return {
        "work_units": [_work_unit(c, anchor) for c in codes],
        "dual_scoring_kappa": 0.85,
    }


def _tenant(db) -> Client:
    client = Client(slug="conflict-co", name="Conflict Co", industry="", description="", kind="client")
    db.add(client)
    db.flush()
    db.add(OrgApiKey(
        client_id=client.id, label="t",
        key_hash=hashlib.sha256(b"k").hexdigest(), is_active=True,
    ))
    db.commit()
    return client


def test_reimporting_existing_ids_is_a_clean_violation_not_a_500(db):
    client = _tenant(db)
    codes = ["WU-A-01", "WU-A-02", "WU-A-03"]

    first = import_genome(db, client.id, _genome(codes), actor="test")
    assert first["accepted"] is True, first
    assert first["work_unit_count"] == 3

    second = import_genome(db, client.id, _genome(codes), actor="test")
    assert second["accepted"] is False
    reported = {v["code"] for v in second["violations"]}
    assert reported == {"work_unit_id_already_exists"}
    # every colliding id is named, so the caller can see what to change
    assert {v["detail"].split(":")[0] for v in second["violations"]} == set(codes)


def test_failed_reimport_leaves_no_partial_rows(db):
    """The original defect: the collision happened mid-loop, so the units
    inserted before it stayed behind and re-poisoned the next attempt."""
    client = _tenant(db)
    first = import_genome(db, client.id, _genome(["WU-B-01", "WU-B-02"]), actor="test")
    assert first["accepted"] is True

    # Overlaps on the second id only — the first would insert cleanly before
    # the old code hit the constraint, which is what left orphans behind.
    import_genome(db, client.id, _genome(["WU-B-09", "WU-B-02"]), actor="test")

    codes = {c for (c,) in db.query(WorkUnit.code).filter(WorkUnit.client_id == client.id).all()}
    assert codes == {"WU-B-01", "WU-B-02"}, "a rejected import must not write any of its rows"
    assert db.query(WorkUnit).filter(WorkUnit.code == "WU-B-09").count() == 0


def test_duplicate_ids_within_one_payload_are_rejected(db):
    client = _tenant(db)
    result = import_genome(db, client.id, _genome(["WU-C-01", "WU-C-01"]), actor="test")

    assert result["accepted"] is False
    assert {v["code"] for v in result["violations"]} == {"duplicate_work_unit_id"}
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 0


def test_blocked_import_is_still_auditable(db):
    """A rejected import must still leave a GenomeVersion row — this module
    deliberately persists blocked imports rather than discarding them."""
    client = _tenant(db)
    import_genome(db, client.id, _genome(["WU-D-01"]), actor="test")
    before = db.query(GenomeVersion).filter(GenomeVersion.client_id == client.id).count()

    rejected = import_genome(db, client.id, _genome(["WU-D-01"]), actor="test")

    after = db.query(GenomeVersion).filter(GenomeVersion.client_id == client.id).count()
    assert after == before + 1
    version = db.query(GenomeVersion).filter(GenomeVersion.id == rejected["version_id"]).one()
    assert version.gates_passed == "[]"
    assert "work_unit_id_already_exists" in version.gates_failed
