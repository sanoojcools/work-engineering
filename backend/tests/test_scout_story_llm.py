"""Story-to-Structure's model path.

The guarantee under test is the one that makes this elevation safe to show an
interviewee: **a quoted span is always something they actually said**. A model
that paraphrases, tidies, or invents a quote must have that span dropped, not
displayed. These tests stub the model rather than call one — the point is to
pin the verification, and a live call would make the result depend on the
model's mood (and cost money on every run).
"""
from __future__ import annotations

import pytest

from app.config import settings
from app.services import llm, scout_story

STORY = (
    "Last Tuesday a candidate accepted our offer, so I collected their joining "
    "documents into the HRIS. That takes about 20 minutes. Then I verify every "
    "document against the signed offer."
)


@pytest.fixture
def llm_on(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "llm_api_key", "test-key-not-used")


def _stub(monkeypatch, body: str):
    monkeypatch.setattr(scout_story.llm, "complete", lambda *a, **k: body)


def test_verbatim_spans_are_kept_with_their_fields(llm_on, monkeypatch):
    _stub(monkeypatch, """[
      {"text": "I collected their joining documents into the HRIS",
       "suggested_name": "Collect joining documents",
       "inputs": "Signed offer", "outputs": "Documents in HRIS",
       "systems": "HRIS", "frequency": "", "pain": "",
       "handoffs": "", "decision_rule": "", "time_minutes": 20}
    ]""")

    result = scout_story.extract_from_story(STORY)

    assert result["used_llm"] is True
    assert len(result["chunks"]) == 1
    chunk = result["chunks"][0]
    assert chunk["text"] in STORY
    assert chunk["suggested_name"] == "Collect joining documents"
    assert chunk["systems"] == "HRIS"
    assert chunk["time_minutes"] == 20


def test_paraphrased_span_is_discarded(llm_on, monkeypatch):
    """The failure this whole design exists to prevent: a plausible sentence
    the interviewee never said, presented back to them as their own words."""
    _stub(monkeypatch, """[
      {"text": "The candidate documents are gathered into the HR system",
       "suggested_name": "Gather documents"},
      {"text": "I verify every document against the signed offer",
       "suggested_name": "Verify documents"}
    ]""")

    chunks = scout_story.extract_from_story(STORY)["chunks"]

    assert [c["suggested_name"] for c in chunks] == ["Verify documents"]
    assert all(c["text"] in STORY for c in chunks)


def test_model_failure_falls_back_and_says_so(llm_on, monkeypatch):
    def boom(*a, **k):
        raise llm.LLMUnavailable("upstream timed out")
    monkeypatch.setattr(scout_story.llm, "complete", boom)

    result = scout_story.extract_from_story(STORY)

    assert result["used_llm"] is False
    assert result["chunks"], "must still return the deterministic split"
    assert "upstream timed out" in result["note"]
    assert all(c["text"] in STORY for c in result["chunks"])


def test_unparseable_response_falls_back(llm_on, monkeypatch):
    _stub(monkeypatch, "I'm afraid I can't help with that.")

    result = scout_story.extract_from_story(STORY)

    assert result["used_llm"] is False
    assert all(c["text"] in STORY for c in result["chunks"])


def test_fields_are_blank_not_invented(llm_on, monkeypatch):
    """A field the transcript doesn't cover must come back empty. Filling it
    with something plausible is exactly the fabrication this refuses."""
    _stub(monkeypatch, """[
      {"text": "I verify every document against the signed offer",
       "suggested_name": "Verify documents",
       "inputs": "", "outputs": "", "systems": "", "frequency": "",
       "pain": "", "handoffs": "", "decision_rule": "", "time_minutes": null}
    ]""")

    chunk = scout_story.extract_from_story(STORY)["chunks"][0]

    assert chunk["systems"] == ""
    assert chunk["time_minutes"] is None


def test_no_model_configured_uses_deterministic_split(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "none")
    result = scout_story.extract_from_story(STORY)

    assert result["used_llm"] is False
    assert "LLM_PROVIDER=none" in result["note"]
    assert all(c["text"] in STORY for c in result["chunks"])
