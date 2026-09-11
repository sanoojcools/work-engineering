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
from pathlib import Path

import yaml

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


DUAL_EMPLOYMENT_PHRASE = "dual employment"


def score_delinquency(chunks: list[dict], transcript: str) -> tuple[list[dict], dict[str, int]]:
    """V10-12 (docs/contracts/v10-12-discovery.md): discovery is a
    *performer*, not a silent author. Deterministic, no extra model call --
    runs on whatever chunks extract_from_story already produced (LLM or
    deterministic path alike) and never trusts them further:

    - invention: a chunk's span is not a case-insensitive substring of the
      transcript -> +1, the chunk is dropped entirely (never returned).
    - distortion: a structured field on a surviving chunk is non-empty and
      is not a substring of that chunk's own span -> +1, the field is
      blanked (the chunk itself is kept).
    - flattery: the transcript names `dual employment` but no surviving
      chunk's span does -> +1. This does not invent a stop row; it only
      counts the omission (the dual-employment stop itself lives in
      services/handoff.py and is untouched here).

    omission is NOT computed here -- section 3 of the contract: a live
    caller's transcript has no hidden "expected" list to compare against.
    See run_golden_set() for the one place omission is honest to compute."""
    counters = {"invention": 0, "omission": 0, "distortion": 0, "flattery": 0}
    transcript_lower = (transcript or "").lower()

    survivors: list[dict] = []
    for chunk in chunks:
        span = str(chunk.get("text", ""))
        if not span or span.lower() not in transcript_lower:
            counters["invention"] += 1
            continue

        kept = dict(chunk)
        for field in GRID_FIELDS:
            value = kept.get(field)
            if isinstance(value, str) and value and value not in span:
                counters["distortion"] += 1
                kept[field] = ""
        survivors.append(kept)

    if DUAL_EMPLOYMENT_PHRASE in transcript_lower:
        if not any(DUAL_EMPLOYMENT_PHRASE in str(c.get("text", "")).lower() for c in survivors):
            counters["flattery"] += 1

    return survivors, counters


def extract_with_delinquency(text: str) -> dict:
    """The route's entry point (V10-12): same `extract_from_story` above,
    plus the performer contract -- `cap` always `execute_with_approval`
    (extracted binding fields are never auto-elevated), and the four
    delinquency counters from `score_delinquency`. `golden` is always
    False here; only `run_golden_set` sets it True."""
    result = extract_from_story(text)
    chunks, counters = score_delinquency(result["chunks"], text or "")
    return {
        "used_llm": result["used_llm"],
        "chunks": chunks,
        "note": result["note"],
        "cap": "execute_with_approval",
        "counters": counters,
        "golden": False,
    }


def run_golden_set(pack_path: str | Path) -> dict:
    """Section 3's golden runner: Offer Desk seed, deterministic path only
    (no live key in tests -- see tests/conftest.py's autouse `_no_live_llm`).
    `omission` is only ever honest here, never on a live caller's
    transcript: each `must_span` item the pack declares is checked against
    every surviving chunk's span; a `must_span` item not found anywhere is
    +1 omission. If the deterministic path returns no chunks at all,
    omission is simply len(must_span) -- not a fake zero."""
    with open(pack_path, encoding="utf-8") as f:
        pack = yaml.safe_load(f)

    transcript = pack["transcript"]
    must_span = pack.get("must_span", [])

    result = extract_with_delinquency(transcript)
    spans_lower = [str(c.get("text", "")).lower() for c in result["chunks"]]

    omission = sum(
        1 for item in must_span
        if not any(str(item).lower() in span for span in spans_lower)
    )

    counters = dict(result["counters"])
    counters["omission"] = omission

    return {
        "used_llm": result["used_llm"],
        "chunks": result["chunks"],
        "note": result["note"],
        "cap": result["cap"],
        "counters": counters,
        "golden": True,
    }
