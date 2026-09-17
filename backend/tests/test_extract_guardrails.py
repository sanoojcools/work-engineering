"""D-3: Extract guardrails ported from Scout v1 / AODP.

Tests for system prompt validation rules that prevent:
- Multiple questions in one prompt (one `?` maximum)
- Automation-framing language (ban "automat*")
- Silent mocks (already enforced: deterministic fallback is explicit)
- Fabricated spans (already enforced: substring verification)

These rules are ported into WEP code, not imported from those repos.
"""
from __future__ import annotations

import pytest

from app.services import scout_story


# --- 1. One `?` rule -----------------------------------------------------

def test_system_prompt_with_one_question_passes():
    """A prompt with exactly one question mark is allowed."""
    prompt = "What is the main task? Return a JSON array."
    scout_story.validate_system_prompt(prompt)  # should not raise


def test_system_prompt_with_zero_questions_passes():
    """A prompt with no question marks is allowed (pure instruction)."""
    prompt = "Extract discrete units of work. Return a JSON array."
    scout_story.validate_system_prompt(prompt)  # should not raise


def test_system_prompt_with_multiple_questions_fails():
    """A prompt with more than one question mark violates the one-question rule."""
    prompt = "What is the task? How long does it take? Return JSON."

    with pytest.raises(scout_story.GuardrailViolation) as exc:
        scout_story.validate_system_prompt(prompt)

    assert "2 question marks" in str(exc.value)
    assert "one question at a time" in str(exc.value)


# --- 2. No automation-framing --------------------------------------------

def test_system_prompt_with_automate_fails():
    """The word 'automate' triggers the automation-framing guardrail."""
    prompt = "Identify tasks we can automate. Return JSON."

    with pytest.raises(scout_story.GuardrailViolation) as exc:
        scout_story.validate_system_prompt(prompt)

    assert "automation-framing" in str(exc.value)
    assert "automate" in str(exc.value).lower()


def test_system_prompt_with_automation_fails():
    """The word 'automation' triggers the automation-framing guardrail."""
    prompt = "Find automation opportunities in this process."

    with pytest.raises(scout_story.GuardrailViolation) as exc:
        scout_story.validate_system_prompt(prompt)

    assert "automation-framing" in str(exc.value)


def test_system_prompt_with_automatically_fails():
    """Words starting with 'automat' are caught case-insensitively."""
    prompt = "Tasks that happen Automatically should be flagged."

    with pytest.raises(scout_story.GuardrailViolation) as exc:
        scout_story.validate_system_prompt(prompt)

    assert "Automatically" in str(exc.value)


def test_system_prompt_with_automated_fails():
    """The word 'automated' triggers the guardrail."""
    prompt = "Which steps are already automated?"

    with pytest.raises(scout_story.GuardrailViolation) as exc:
        scout_story.validate_system_prompt(prompt)

    assert "automated" in str(exc.value).lower()


def test_system_prompt_without_automat_words_passes():
    """A prompt without automation-framing words is allowed."""
    prompt = "Extract the discrete tasks described. Return JSON."
    scout_story.validate_system_prompt(prompt)  # should not raise


# --- 3. Current _SYSTEM prompt passes ------------------------------------

def test_current_system_prompt_passes_guardrails():
    """The existing _SYSTEM prompt in scout_story.py must pass validation."""
    # This ensures the guardrails don't break the existing extract path
    scout_story.validate_system_prompt(scout_story._SYSTEM)


# --- 4. Guardrail violation triggers deterministic fallback -------------

def test_guardrail_violation_falls_back_to_deterministic(monkeypatch):
    """When a guardrail fails, extract_from_story falls back to
    deterministic mode rather than silently using a bad prompt."""
    from app.config import settings

    # Enable LLM so the guardrail check runs
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "llm_api_key", "test-key")

    # Inject a bad system prompt that violates guardrails
    bad_prompt = "What tasks? What can we automate?"
    monkeypatch.setattr(scout_story, "_SYSTEM", bad_prompt)

    story = "I verify documents every Tuesday."
    result = scout_story.extract_from_story(story)

    assert result["used_llm"] is False
    assert "guardrail validation" in result["note"]
    assert len(result["chunks"]) > 0  # deterministic split still works
    assert all(c["text"] in story for c in result["chunks"])


# --- 5. Span verification still enforced (existing guardrail) -----------

def test_span_must_be_substring_is_still_enforced(monkeypatch):
    """The existing substring verification guardrail (fail closed) is
    unchanged — spans not found verbatim are still dropped."""
    from app.config import settings

    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "llm_api_key", "test-key")

    story = "I verify candidate documents every week."

    # Mock a response with a paraphrased (non-verbatim) span
    def mock_complete(*a, **k):
        return """[
          {"text": "The documents are verified weekly",
           "suggested_name": "Verify documents"}
        ]"""

    monkeypatch.setattr(scout_story.llm, "complete", mock_complete)

    result = scout_story.extract_from_story(story)

    # The paraphrased span should be dropped (not a substring)
    assert result["used_llm"] is True
    assert len(result["chunks"]) == 0  # nothing verbatim survived


# --- 6. No silent mock (existing guardrail) -----------------------------

def test_deterministic_fallback_is_never_silent():
    """When LLM is disabled or fails, the deterministic fallback is
    explicit in the note — never presented as if it were extracted."""
    from app.config import settings
    import pytest

    # Force LLM off
    import importlib
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(settings, "llm_provider", "none")

    story = "I process refunds on Tuesdays."
    result = scout_story.extract_from_story(story)

    assert result["used_llm"] is False
    assert "LLM_PROVIDER=none" in result["note"]
    assert "deterministic sentence split" in result["note"]
    assert "not extracted work units" in result["note"]

    monkeypatch.undo()
