"""Regression cover for a real 500 found running the Document check walk
under concurrent load: PUT /api/verdict/{id} occasionally 500'd with
exc_type=IntegrityError.

Root cause, reproduced live against a real local Postgres 16 (not guessed):
services/work_units.py::apply_verdict is a check-then-insert upsert
(`row = wu.verdict; if row is None: db.add(VerdictScore(...))`) and
verdict_scores.work_unit_id is UNIQUE. Two concurrent first-time PUTs for
the same not-yet-scored work unit both see wu.verdict as None and both try
to insert -- 20 concurrent PUTs to one freshly created work unit's VERDICT,
fired at a real running uvicorn (X-Spec-Key attached, pinning the tenant),
reproduced this reliably (1/20 500'd with exc_type=IntegrityError in the
structured error log before this fix; 0/20 after, across repeated runs).

SQLite is enough for this test: the race itself doesn't depend on RLS or
real concurrency, only on the unique constraint and a session that has
already cached wu.verdict as None before a competing row lands -- the same
"simulate the collision deterministically, in one session" idiom
test_genome_import_conflicts.py already uses for the analogous
work_units.code race.
"""
from __future__ import annotations

from app.models.client import Client
from app.models.ontology import EntityKind, EntityType
from app.models.verdict import VerdictScore
from app.models.workunit import ActorType, WorkUnit
from app.services.work_units import apply_verdict


SCORES = dict(
    verifiability=5, evidence=5, reversibility=5, determinism=5,
    impact_scope=4, compliance=5, tacitness=5,
)


def _work_unit(db) -> WorkUnit:
    client = Client(slug="race-co", name="Race Co", industry="", description="", kind="client")
    db.add(client)
    entity_type = EntityType(name="Employee-race", kind=EntityKind.business_object)
    db.add(entity_type)
    db.flush()
    wu = WorkUnit(
        client_id=client.id,
        code="WU-RACE-01",
        name="Race condition test unit",
        business_object_type_id=entity_type.id,
        current_condition="start",
        desired_condition="end",
        owner="Test",
        actor_type=ActorType.human,
        evidence_required="a log entry",  # so gate4_evidence doesn't cap the level below what the test asserts
    )
    db.add(wu)
    db.commit()
    db.refresh(wu)
    return wu


def test_concurrent_first_score_does_not_500(db):
    """The exact race: wu.verdict cached as None, then a competing insert
    for the same work_unit_id lands before this session's own flush."""
    wu = _work_unit(db)
    assert wu.verdict is None  # caches the lazy-loaded relationship as None

    # Simulate a concurrent request that already won the race and committed
    # first -- same shape as the real live reproduction, minus the second
    # HTTP connection.
    winner = VerdictScore(work_unit_id=wu.id, origin="confirmed")
    db.add(winner)
    db.commit()

    # apply_verdict must not blow up on the loser's flush -- it should fall
    # back to the winner's row instead of surfacing the IntegrityError.
    row = apply_verdict(db, wu, SCORES)

    assert row.id == winner.id
    assert row.work_unit_id == wu.id
    assert row.verifiability == 5
    assert row.recommended_level == 6

    # Exactly one VerdictScore row for this unit -- the loser's insert
    # attempt did not leave a duplicate or a half-written row behind.
    rows = db.query(VerdictScore).filter(VerdictScore.work_unit_id == wu.id).all()
    assert len(rows) == 1


def test_uncontended_first_score_still_creates_a_row(db):
    """Non-regression: the ordinary, uncontested path still creates a real
    row rather than always taking the fallback-update branch."""
    wu = _work_unit(db)
    assert wu.verdict is None

    row = apply_verdict(db, wu, SCORES)

    assert row.work_unit_id == wu.id
    assert db.query(VerdictScore).filter(VerdictScore.work_unit_id == wu.id).count() == 1


def test_second_score_updates_the_existing_row_in_place(db):
    """Non-regression: re-scoring an already-scored unit (the ordinary
    update path, no race involved) still updates rather than duplicating."""
    wu = _work_unit(db)
    first = apply_verdict(db, wu, SCORES)

    lower = {**SCORES, "evidence": 1}
    second = apply_verdict(db, wu, lower)

    assert second.id == first.id
    assert second.evidence == 1
    assert db.query(VerdictScore).filter(VerdictScore.work_unit_id == wu.id).count() == 1
