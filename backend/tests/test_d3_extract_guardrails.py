"""D-3: extract rules in this repo. Tests stub the model. Never a live call."""
from __future__ import annotations

import pytest

from app.config import settings
from app.services import scout_story

STORY = (
    "Last Tuesday a candidate accepted our offer, so I collected their joining "
    "documents into the HRIS. That takes about 20 minutes. Then I verify every "
    "document against the signed offer."
)

AUTOMATION_STORY = (
    "Rashmi checks documents. She said we should automate the UAN lookup next year."
)


@pytest.fixture
def llm_on(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "llm_api_key", "test-key-not-used")


def _stub(monkeypatch, body: str):
    monkeypatch.setattr(scout_story.llm, "complete", lambda *a, **k: body)


def test_two_question_marks_in_reading_keeps_nothing(llm_on, monkeypatch):
    _stub(monkeypatch, """[
      {"text": "I verify every document against the signed offer",
       "suggested_name": "Verify documents?",
       "pain": "Who owns this next?"}
    ]""")

    result = scout_story.extract_from_story(STORY)

    assert result["used_llm"] is True
    assert result["chunks"] == []
    assert "more than one question" in result["note"]
    assert "not a sentence split" in result["note"].lower()


def test_automation_framing_without_speaker_word_keeps_nothing(llm_on, monkeypatch):
    _stub(monkeypatch, """[
      {"text": "I collected their joining documents into the HRIS",
       "suggested_name": "Collect joining documents",
       "pain": "What can we automate here?"}
    ]""")

    result = scout_story.extract_from_story(STORY)

    assert result["used_llm"] is True
    assert result["chunks"] == []
    assert "automate" in result["note"].lower()
    assert "not a sentence split" in result["note"].lower()


def test_speaker_said_automate_so_reading_may_echo_it(llm_on, monkeypatch):
    _stub(monkeypatch, """[
      {"text": "we should automate the UAN lookup next year",
       "suggested_name": "Plan UAN lookup",
       "pain": "automate the UAN lookup"}
    ]""")

    result = scout_story.extract_from_story(AUTOMATION_STORY)

    assert result["used_llm"] is True
    assert len(result["chunks"]) == 1
    assert result["chunks"][0]["text"] in AUTOMATION_STORY


def test_clean_reading_still_keeps_verbatim_span(llm_on, monkeypatch):
    _stub(monkeypatch, """[
      {"text": "I verify every document against the signed offer",
       "suggested_name": "Verify documents",
       "inputs": "", "outputs": "", "systems": "", "frequency": "",
       "pain": "", "handoffs": "", "decision_rule": "", "time_minutes": null}
    ]""")

    result = scout_story.extract_from_story(STORY)

    assert result["used_llm"] is True
    assert len(result["chunks"]) == 1
    assert result["chunks"][0]["text"] in STORY


def test_refused_extract_with_delinquency_stays_empty(llm_on, monkeypatch):
    _stub(monkeypatch, """[
      {"text": "I verify every document against the signed offer",
       "suggested_name": "Verify?",
       "pain": "Automate this desk?"}
    ]""")

    result = scout_story.extract_with_delinquency(STORY)

    assert result["used_llm"] is True
    assert result["chunks"] == []
    assert result["cap"] == "execute_with_approval"
    assert result["golden"] is False
