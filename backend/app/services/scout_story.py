"""Elevation 4: Story to Structure.

Turns a few sentences of narrative into candidate Work Capture Grid rows.

With a model configured (LLM_PROVIDER=anthropic + a key) this really does
extract: it returns the verbatim span each row came from, plus a first pass at
the grid's structured fields. Without one it degrades to a deterministic
sentence-chunker — the same philosophy as discovery.split_text — and says so.

The guardrail is identical in both modes and is enforced here, not trusted:
**every returned span must be a literal substring of what was said**
(SCOUT_AMBITIOUS_PLAN.md section 4). The deterministic path satisfies that by
construction; the model path is *verified* against it, and any span the model
paraphrased or invented is dropped. A model can be wrong about what someone
said — this is the check that stops that becoming a fabricated work unit.

The structured fields are a different matter and are labelled as such: they
are the model's reading of the span, not quotes from it, so the interviewer
reviews them before they become rows.
"""
from __future__ import annotations

import json
import logging
import re

from . import llm

logger = logging.getLogger(__name__)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
MIN_CHUNK_LEN = 8
MAX_CHUNKS = 12

# Only fields the Work Capture Grid actually has. Anything else the model
# returns is discarded rather than silently carried around.
GRID_FIELDS = (
    "inputs", "outputs", "systems", "frequency",
    "pain", "handoffs", "decision_rule", "time_minutes",
)

_SYSTEM = """You extract discrete units of work from an interview transcript.

A unit of work is one accountable task that moves something from a starting \
condition to a finished one — "process a refund request", not "be helpful" \
and not "work in the finance team".

Return ONLY a JSON array. Each element:
{
  "text": "<the EXACT verbatim substring of the transcript this came from>",
  "suggested_name": "<short verb-noun name, max 8 words>",
  "inputs": "<what starts it / what arrives>",
  "outputs": "<what exists when it is done>",
  "systems": "<systems or tools named, comma separated>",
  "frequency": "<how often, e.g. daily / weekly / 12x per week>",
  "pain": "<the friction described, if any>",
  "handoffs": "<who it goes to next, if stated>",
  "decision_rule": "<any rule or threshold stated>",
  "time_minutes": <integer minutes per case, or null>
}

Rules:
- "text" MUST be copied character-for-character from the transcript. Do not \
paraphrase, tidy, or join across gaps. It is checked, and any element whose \
"text" is not found verbatim is discarded.
- Leave a field as "" (or null for time_minutes) when the transcript does not \
say. Do not guess, and do not invent plausible-sounding detail.
- Return [] if the transcript describes no concrete work.
- No prose, no markdown fences — the JSON array only."""


def _deterministic_chunks(text: str) -> list[dict]:
    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text.strip()) if s.strip()]
    chunks = []
    for s in sentences:
        if len(s) < MIN_CHUNK_LEN:
            continue
        chunks.append({"text": s, "suggested_name": " ".join(s.split()[:8])})
    return chunks


def _coerce_time(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, float):
        return int(value) if value > 0 else None
    if isinstance(value, str):
        digits = re.sub(r"[^0-9]", "", value)
        if digits:
            n = int(digits)
            return n if n > 0 else None
    return None


def _parse_llm_chunks(body: str, source: str) -> list[dict]:
    """Parse the model's array and enforce the substring guarantee.

    Anything that fails verification is dropped rather than repaired: a span
    that isn't in the transcript is exactly the failure mode this elevation
    must not have."""
    start, end = body.find("["), body.rfind("]")
    if start == -1 or end == -1:
        raise llm.LLMUnavailable("Model did not return a JSON array")
    try:
        raw = json.loads(body[start:end + 1])
    except json.JSONDecodeError as exc:
        raise llm.LLMUnavailable(f"Model returned invalid JSON: {exc}") from exc
    if not isinstance(raw, list):
        raise llm.LLMUnavailable("Model did not return a JSON array")

    chunks: list[dict] = []
    dropped = 0
    for item in raw[:MAX_CHUNKS]:
        if not isinstance(item, dict):
            dropped += 1
            continue
        span = str(item.get("text", "")).strip()
        # The whole point: verbatim or not at all.
        if not span or span not in source:
            dropped += 1
            continue

        chunk = {
            "text": span,
            "suggested_name": str(item.get("suggested_name") or " ".join(span.split()[:8]))[:200],
        }
        for field in GRID_FIELDS:
            value = item.get(field)
            if field == "time_minutes":
                chunk[field] = _coerce_time(value)
            else:
                chunk[field] = str(value).strip() if value else ""
        chunks.append(chunk)

    if dropped:
        logger.info("story extraction dropped %d span(s) not found verbatim", dropped)
    return chunks


def extract_from_story(text: str) -> dict:
    source = text or ""

    if llm.is_enabled():
        try:
            body = llm.complete(
                f"Transcript:\n\n{source}",
                system=_SYSTEM,
                max_tokens=4096,
            )
            chunks = _parse_llm_chunks(body, source)
            return {
                "used_llm": True,
                "chunks": chunks,
                "note": (
                    f"Extracted by {llm.describe()}. Every quoted span was checked against "
                    "your transcript and any the model did not copy verbatim was discarded. "
                    "The structured fields are the model's reading of each span, not quotes — "
                    "review them before adding the rows."
                ),
            }
        except llm.LLMUnavailable as exc:
            # A model that is configured but failing must not take the panel
            # down, and must not quietly look like the deterministic mode.
            return {
                "used_llm": False,
                "chunks": _deterministic_chunks(source),
                "note": (
                    f"The model call failed ({exc}), so this is the deterministic sentence "
                    "split instead — each chunk is a literal substring of what you said, "
                    "not extracted work units."
                ),
            }

    return {
        "used_llm": False,
        "chunks": _deterministic_chunks(source),
        "note": (
            "No model configured (LLM_PROVIDER=none) — this is a deterministic sentence "
            "split, not extracted work units. Each chunk is a literal substring of what "
            "you said; turn the ones that describe real work into Work Capture Grid rows "
            "yourself."
        ),
    }
