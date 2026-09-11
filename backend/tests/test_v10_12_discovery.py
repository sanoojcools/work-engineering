"""V10-12 (docs/contracts/v10-12-discovery.md): discovery as a performer,
not a silent author. Four delinquency counters -- invention, omission,
distortion, flattery -- scored deterministically on every
POST /api/scout/extract-from-story call, and a tenant's running totals at
GET /api/scout/delinquency.

Pure-function tests (score_delinquency, run_golden_set) need no database
and run under plain SQLite. Anything that persists a tenant's running
totals goes through the real HTTP route and needs Postgres for the same
reason every other tenant-scoped suite in this repo does -- see
test_pointers.py / test_scout_pain_story.py's own comment on this. No live
LLM anywhere: tests/conftest.py's autouse `_no_live_llm` fixture forces
LLM_PROVIDER=none for the whole suite, so used_llm is always False here and
commit=true is the only way a call bumps totals.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models.pointers import PointerStatus
from app.models.workunit import WorkUnit
from app.services import pointers as pointers_svc
from app.services import scout_story as story_svc

GOLDEN_PACK = Path(__file__).resolve().parents[2] / "packs" / "hr" / "golden_extract.yaml"

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


def _make_tenant(session, slug):
    raw_key = f"test-{slug}-key-" + "d" * 20
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


def _cleanup(session, client_ids):
    ids = {"ids": client_ids}
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
    key_a, cid_a = _make_tenant(session, "delinq-a")
    key_b, cid_b = _make_tenant(session, "delinq-b")
    session.commit()
    session.close()

    yield {
        "key_a": key_a, "client_a_id": cid_a, "headers_a": {"X-Spec-Key": key_a},
        "key_b": key_b, "client_b_id": cid_b, "headers_b": {"X-Spec-Key": key_b},
    }

    session = SetupSession()
    _cleanup(session, [cid_a, cid_b])
    session.close()


STORY = (
    "Last Tuesday I checked for dual employment before proceeding. "
    "I verify candidate documents against the signed offer."
)


# --- 1. invention -----------------------------------------------------

def test_invented_span_counts_and_is_dropped():
    chunks = [
        {"text": "I verify candidate documents against the signed offer", "systems": ""},
        {"text": "The candidate was cleared by a background agency", "systems": ""},  # not in STORY
    ]
    survivors, counters = story_svc.score_delinquency(chunks, STORY)

    assert counters["invention"] == 1
    assert len(survivors) == 1
    assert survivors[0]["text"] == "I verify candidate documents against the signed offer"


def test_invention_is_case_insensitive():
    chunks = [{"text": "I VERIFY CANDIDATE DOCUMENTS against the signed offer", "systems": ""}]
    survivors, counters = story_svc.score_delinquency(chunks, STORY)

    assert counters["invention"] == 0
    assert len(survivors) == 1


# --- 2. distortion ------------------------------------------------------

def test_field_not_in_span_counts_and_is_blanked():
    chunks = [{
        "text": "I verify candidate documents against the signed offer",
        "suggested_name": "Verify documents",
        "systems": "Workday",  # not present in the span -- invented detail
    }]
    survivors, counters = story_svc.score_delinquency(chunks, STORY)

    assert counters["distortion"] == 1
    assert survivors[0]["systems"] == ""
    # the chunk itself survives -- distortion blanks the field, not the chunk
    assert len(survivors) == 1


def test_field_that_is_a_substring_of_its_own_span_is_not_distortion():
    chunks = [{
        "text": "I verify candidate documents against the signed offer",
        "pain": "candidate documents",
    }]
    _survivors, counters = story_svc.score_delinquency(chunks, STORY)

    assert counters["distortion"] == 0


# --- 3. flattery ----------------------------------------------------------

def test_flattery_counted_when_dual_employment_named_but_not_quoted():
    chunks = [{"text": "I verify candidate documents against the signed offer"}]
    _survivors, counters = story_svc.score_delinquency(chunks, STORY)

    assert counters["flattery"] == 1


def test_no_flattery_when_a_surviving_span_names_dual_employment():
    chunks = [{"text": "I checked for dual employment before proceeding"}]
    _survivors, counters = story_svc.score_delinquency(chunks, STORY)

    assert counters["flattery"] == 0


def test_no_flattery_when_transcript_never_named_it():
    chunks = [{"text": "I checked the order in the ERP"}]
    _survivors, counters = story_svc.score_delinquency(chunks, "I checked the order in the ERP.")

    assert counters["flattery"] == 0


# --- 4. golden runner / omission ------------------------------------------

def test_golden_runner_reports_omission_honestly():
    result = story_svc.run_golden_set(GOLDEN_PACK)

    assert result["golden"] is True
    assert result["used_llm"] is False  # autouse fixture forces LLM_PROVIDER=none
    assert isinstance(result["counters"]["omission"], int)
    assert result["counters"]["omission"] >= 0
    # both must_span items are literal substrings of the deterministic split
    assert result["counters"]["omission"] == 0
    assert result["counters"]["flattery"] == 0
    assert result["counters"]["invention"] == 0


def test_golden_runner_omission_is_full_count_when_nothing_survives(monkeypatch):
    monkeypatch.setattr(story_svc, "extract_from_story", lambda text: {
        "used_llm": False, "chunks": [], "note": "nothing extracted",
    })
    result = story_svc.run_golden_set(GOLDEN_PACK)

    assert result["chunks"] == []
    assert result["counters"]["omission"] == 2  # len(must_span)


# --- 5. commit flag + tenant totals (real HTTP, real Postgres) ------------

def _mock_extract_drops_dual_employment_sentence(monkeypatch):
    """The deterministic split always keeps a sentence naming `dual
    employment` intact (it is a literal substring by construction, and
    always well over MIN_CHUNK_LEN), so flattery cannot actually fire
    through the live deterministic path -- there is nothing here for it to
    catch, honestly. Stand in for what a paraphrasing model's dropped span
    would look like, so the commit-flag plumbing itself is still exercised
    end-to-end against a real, non-zero counter."""
    monkeypatch.setattr(story_svc, "extract_from_story", lambda text: {
        "used_llm": False,
        "chunks": [{"text": "I verify candidate documents against the signed offer"}],
        "note": "stubbed for commit-flag test",
    })


@pg_skip
def test_commit_false_does_not_bump_totals(real_client, two_tenants, monkeypatch):
    _mock_extract_drops_dual_employment_sentence(monkeypatch)
    headers = two_tenants["headers_a"]
    r = real_client.post("/api/scout/extract-from-story", headers=headers, json={
        "transcript_chunk": STORY, "commit": False,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cap"] == "execute_with_approval"
    assert body["golden"] is False
    assert body["counters"]["flattery"] == 1  # dual employment named, no chunk quotes it

    totals = real_client.get("/api/scout/delinquency", headers=headers).json()
    assert totals == {"invention": 0, "omission": 0, "distortion": 0, "flattery": 0}


@pg_skip
def test_commit_true_bumps_totals_and_isolates_tenants(real_client, two_tenants, monkeypatch):
    _mock_extract_drops_dual_employment_sentence(monkeypatch)
    headers_a = two_tenants["headers_a"]
    headers_b = two_tenants["headers_b"]

    r = real_client.post("/api/scout/extract-from-story", headers=headers_a, json={
        "transcript_chunk": STORY, "commit": True,
    })
    assert r.status_code == 200, r.text

    totals_a = real_client.get("/api/scout/delinquency", headers=headers_a).json()
    assert totals_a["flattery"] == 1

    totals_b = real_client.get("/api/scout/delinquency", headers=headers_b).json()
    assert totals_b == {"invention": 0, "omission": 0, "distortion": 0, "flattery": 0}


@pg_skip
def test_commit_true_accumulates_never_subtracts(real_client, two_tenants, monkeypatch):
    _mock_extract_drops_dual_employment_sentence(monkeypatch)
    headers = two_tenants["headers_a"]
    for _ in range(2):
        real_client.post("/api/scout/extract-from-story", headers=headers, json={
            "transcript_chunk": STORY, "commit": True,
        })
    totals = real_client.get("/api/scout/delinquency", headers=headers).json()
    assert totals["flattery"] == 2


@pg_skip
def test_delinquency_requires_key(real_client):
    assert real_client.get("/api/scout/delinquency").status_code == 401


@pg_skip
def test_delinquency_zero_for_new_tenant(real_client, two_tenants):
    totals = real_client.get("/api/scout/delinquency", headers=two_tenants["headers_a"]).json()
    assert totals == {"invention": 0, "omission": 0, "distortion": 0, "flattery": 0}


# --- 6. binding fields cannot be written as declared/observed from extract -

def test_binding_field_from_extract_is_rejected_not_saved(db):
    """A chunk from extract-from-story carries no file_id -- there is
    nothing for the resolver to open. authority/acceptance_criteria/
    actor_constraints (BINDING_FIELDS, services/pointers.py) may only stand
    as `declared` with a resolver-verified quote; with no file cited that
    can never be true, so the write is rejected outright (422), never
    persisted at a downgraded status. HONESTY.md names this explicitly."""
    wu = WorkUnit(id=999999, client_id=1, code="WU-TEST-BINDING")

    with pytest.raises(HTTPException) as exc:
        pointers_svc.upsert_field_pointer(
            db, wu,
            field_name="authority",
            requested_status=PointerStatus.declared,
            file_id=None, page=None, line=None, cell=None,
            quote="I verify candidate documents against the signed offer",
        )
    assert exc.value.status_code == 422


# --- 7. dual-employment stop still unliftable -----------------------------

def test_dual_employment_phrase_constant_matches_the_stop():
    """Not a re-test of services/handoff.py's stop (V10-11's own suite owns
    that) -- just that this slice's flattery detector recognizes the exact
    phrase the stop is keyed on, so it can never quietly drift apart from
    it."""
    assert story_svc.DUAL_EMPLOYMENT_PHRASE == "dual employment"


# --- 8. no live LLM anywhere -----------------------------------------------

def test_extract_with_delinquency_never_touches_a_live_model(monkeypatch):
    """tests/conftest.py's autouse fixture already forces LLM_PROVIDER=none
    for the whole suite; this pins that extract_with_delinquency's result
    reflects it directly, so a regression there fails loudly here too."""
    result = story_svc.extract_with_delinquency(STORY)
    assert result["used_llm"] is False
    assert result["golden"] is False
    assert result["cap"] == "execute_with_approval"
    assert set(result["counters"]) == {"invention", "omission", "distortion", "flattery"}
