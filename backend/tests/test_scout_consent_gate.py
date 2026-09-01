"""Track 3 of the enterprise-readiness roadmap ("make the spec
trustworthy"), second piece: consent as an enforced precondition. Closes
the gap Part K9 named as open -- "the genome-import pipeline does not yet
read the one a session might cite" -- for the one path that can genuinely
make that claim: a live Scout session's own consent_receipt_id, checked by
services/genome_import.py::_validate_consent via
services/scout_genome.py::generate_genome's enforce_consent=True.

Tested here directly against import_genome(enforce_consent=True) with a
constructed, GQS-passing payload -- not through the real Scout HTTP flow.
Scout-generated genomes always set dependencies=[] (never captured by the
Work Capture Grid), which GQS's own completeness check treats as a missing
attribute on every unit, so a real Scout session's genome is always
blocked by GQS first (documented: an 8-unit, 100%-complete session scores
GQS 30) -- the consent gate would never be reached to test in isolation
that way. SQLite is enough: this is pure Python/SQLAlchemy logic with no
RLS or Postgres-specific behavior involved (same reasoning as
test_genome_import_cycles.py).
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from app.models.client import Client
from app.models.security import ConsentReceipt, ConsentStatus, GenomeVersion, OrgApiKey, WorkUnitProvenanceDetail
from app.models.workunit import WorkUnit
from app.services.genome_import import import_genome


def _wu(code: str, *, interview_id: str | None, consent_receipt_id: str | None) -> dict:
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
        "dependencies": ["external-input"],
        "failure_semantics": "hold and notify",
        "regulatory_register_link": ["RR-001"],
        "provenance": {
            # "observed", not "declared": GQS weights Observed% at 40% of
            # the score, and this file's own tests need a genome that can
            # actually clear the >=90 gate to isolate testing the consent
            # gate from that separate, documented, deliberate cap (see
            # scout_genome.py's own docstring) -- same shape the real
            # sample genome uses for a unit whose evidence blends a
            # document row with a corroborating interview.
            "source_type": "observed",
            "hash_sha256": "a" * 64,
            "interview_id": interview_id,
            "consent_receipt_id": consent_receipt_id,
        },
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


def _receipt(db, client_id: int, *, status: ConsentStatus = ConsentStatus.active) -> ConsentReceipt:
    receipt = ConsentReceipt(
        client_id=client_id, interview_ref="Anjali", purpose="test",
        consent_timestamp=datetime.now(timezone.utc), retention_days=90,
        auto_purge_at=datetime.now(timezone.utc) + timedelta(days=90),
        status=status,
    )
    db.add(receipt)
    db.commit()
    return receipt


def test_enforce_consent_false_ignores_missing_consent(db):
    """The generic JSON-body import path (enforce_consent=False, its
    default) stays permissive -- interview_id/consent_receipt_id are free
    text a caller can set to anything, including the shipped sample
    genome's decorative pre-consent-feature values. Not this gate's job."""
    client = _tenant(db, "consent-off")
    genome = _genome([_wu("WU-P1", interview_id="some-interview", consent_receipt_id=None)])

    result = import_genome(db, client.id, genome, actor="test")

    assert result["accepted"] is True, result
    assert not any(v["code"] in ("missing_consent", "invalid_consent") for v in result.get("violations", []))


def test_enforce_consent_true_blocks_missing_receipt(db):
    client = _tenant(db, "consent-missing")
    genome = _genome([_wu("WU-C1", interview_id="scout-session-1", consent_receipt_id=None)])

    result = import_genome(db, client.id, genome, actor="test", enforce_consent=True)

    assert result["accepted"] is False
    assert any(v["code"] == "missing_consent" for v in result["violations"])
    assert db.query(WorkUnit).filter(WorkUnit.client_id == client.id).count() == 0


def test_enforce_consent_true_blocks_unresolvable_receipt_id(db):
    client = _tenant(db, "consent-unresolved")
    genome = _genome([_wu("WU-C2", interview_id="scout-session-2", consent_receipt_id="999999")])

    result = import_genome(db, client.id, genome, actor="test", enforce_consent=True)

    assert result["accepted"] is False
    assert any(v["code"] == "invalid_consent" for v in result["violations"])


def test_enforce_consent_true_blocks_non_integer_receipt_id(db):
    """The shipped sample genome's own decorative provenance uses
    UUID-shaped consent_receipt_id values -- if a caller ever turned
    enforce_consent on for data shaped like that, it must fail cleanly,
    not raise."""
    client = _tenant(db, "consent-nonint")
    genome = _genome([_wu(
        "WU-C3", interview_id="scout-session-3",
        consent_receipt_id="ce8a8faf-cfde-5a6e-b707-9dd28a4b1fee",
    )])

    result = import_genome(db, client.id, genome, actor="test", enforce_consent=True)

    assert result["accepted"] is False
    assert any(v["code"] == "invalid_consent" for v in result["violations"])


def test_enforce_consent_true_blocks_revoked_receipt(db):
    client = _tenant(db, "consent-revoked")
    receipt = _receipt(db, client.id, status=ConsentStatus.withdrawn)
    genome = _genome([_wu("WU-C4", interview_id="scout-session-4", consent_receipt_id=str(receipt.id))])

    result = import_genome(db, client.id, genome, actor="test", enforce_consent=True)

    assert result["accepted"] is False
    violation = next(v for v in result["violations"] if v["code"] == "invalid_consent")
    assert "withdrawn" in violation["detail"]


def test_enforce_consent_true_blocks_another_tenants_receipt(db):
    """RLS isolates consent_receipts per tenant in production; this proves
    the gate's own lookup is client-scoped too, independent of RLS."""
    client_a = _tenant(db, "consent-tenant-a")
    client_b = _tenant(db, "consent-tenant-b")
    receipt_b = _receipt(db, client_b.id)
    genome = _genome([_wu("WU-C5", interview_id="scout-session-5", consent_receipt_id=str(receipt_b.id))])

    result = import_genome(db, client_a.id, genome, actor="test", enforce_consent=True)

    assert result["accepted"] is False
    assert any(v["code"] == "invalid_consent" for v in result["violations"])


def test_enforce_consent_true_passes_with_a_real_active_receipt(db):
    """Consent satisfied -> the outcome goes back to being decided by GQS,
    same as before this gate existed -- proving it doesn't silently
    short-circuit the real quality gate once it's cleared."""
    client = _tenant(db, "consent-active")
    receipt = _receipt(db, client.id)
    genome = _genome([_wu("WU-C6", interview_id="scout-session-6", consent_receipt_id=str(receipt.id))])

    result = import_genome(db, client.id, genome, actor="test", enforce_consent=True)

    assert result["accepted"] is True, result
    wu = db.query(WorkUnit).filter(WorkUnit.client_id == client.id, WorkUnit.code == "WU-C6").one()
    detail = db.query(WorkUnitProvenanceDetail).filter(WorkUnitProvenanceDetail.work_unit_id == wu.id).one()
    assert detail.consent_receipt_id == receipt.id


def test_units_with_no_interview_id_are_unaffected_even_with_enforce_consent_true(db):
    """A document-sourced unit within the same batch (no interview_id) has
    nothing to consent to -- enforce_consent=True must not demand a
    receipt for it."""
    client = _tenant(db, "consent-mixed")
    genome = _genome([_wu("WU-C7", interview_id=None, consent_receipt_id=None)])

    result = import_genome(db, client.id, genome, actor="test", enforce_consent=True)

    assert result["accepted"] is True, result


def test_blocked_by_consent_still_leaves_an_auditable_version_row(db):
    client = _tenant(db, "consent-audit")
    genome = _genome([_wu("WU-C8", interview_id="scout-session-8", consent_receipt_id=None)])

    import_genome(db, client.id, genome, actor="test", enforce_consent=True)

    version = db.query(GenomeVersion).filter(GenomeVersion.client_id == client.id).one()
    assert version.gates_passed == "[]"
    assert "missing_consent" in version.gates_failed
