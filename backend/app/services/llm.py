"""Single place the app talks to a model.

Both call sites (discovery candidate suggestion, Scout story extraction) went
through hand-rolled httpx POSTs before this; that meant two copies of the
request shape and no shared timeout, retry, or error handling. This wraps the
official Anthropic SDK once so the rest of the codebase never constructs a
request itself.

`LLM_PROVIDER=none` (the default) is a real, supported state, not a
degraded one — every caller has a deterministic path and must keep working
with no key configured. `is_enabled()` is how a caller asks.
"""
from __future__ import annotations

import logging

from ..config import settings

logger = logging.getLogger(__name__)


class LLMUnavailable(RuntimeError):
    """Raised when a caller asks for a completion and the call could not be
    made or came back unusable. Callers are expected to catch this and fall
    back to their deterministic path rather than surface an error — a missing
    or failing model must never take a page down."""


def is_enabled() -> bool:
    return settings.llm_provider == "anthropic" and bool(settings.llm_api_key)


def describe() -> str:
    """Short, honest description of what is actually configured, for UI copy."""
    if not is_enabled():
        return "no model configured (LLM_PROVIDER=none)"
    return f"{settings.llm_model} via the Anthropic API"


def complete(prompt: str, *, system: str = "", max_tokens: int = 4096) -> str:
    """One non-streaming completion. Returns the concatenated text blocks.

    Deliberately narrow: callers pass a prompt and get text back. Anything
    that needs tools, streaming, or multi-turn state should not be squeezed
    through here."""
    if not is_enabled():
        raise LLMUnavailable("No model configured")

    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - dependency is pinned
        raise LLMUnavailable("anthropic SDK is not installed") from exc

    client = anthropic.Anthropic(api_key=settings.llm_api_key, timeout=60.0)
    try:
        response = client.messages.create(
            model=settings.llm_model,
            max_tokens=max_tokens,
            system=system or anthropic.NOT_GIVEN,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as exc:
        logger.warning("LLM call failed: %s", exc)
        raise LLMUnavailable(str(exc)) from exc

    if response.stop_reason == "refusal":
        raise LLMUnavailable("The model declined this request")

    text = "".join(block.text for block in response.content if block.type == "text")
    if not text.strip():
        raise LLMUnavailable("Empty response")
    return text
