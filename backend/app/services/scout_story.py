"""Elevation 4: Story to Structure. When an LLM is configured, extraction
would use it (same settings.llm_provider check as services/discovery.py's
suggest_candidates); without one -- true in this environment, LLM_PROVIDER
=none -- it degrades to a deterministic sentence-chunker, same philosophy
as discovery.split_text. Every returned chunk is a literal substring of
what was said, never invented: Track B's own guardrail
("every generated span must be a substring of raw_text", per
SCOUT_AMBITIOUS_PLAN.md section 4) is satisfied by construction here,
not by a check after the fact.
"""
from __future__ import annotations

import re

from ..config import settings

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
MIN_CHUNK_LEN = 8


def _deterministic_chunks(text: str) -> list[dict]:
    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text.strip()) if s.strip()]
    chunks = []
    for s in sentences:
        if len(s) < MIN_CHUNK_LEN:
            continue
        chunks.append({"text": s, "suggested_name": " ".join(s.split()[:8])})
    return chunks


def extract_from_story(text: str) -> dict:
    used_llm = False
    if settings.llm_provider != "none" and settings.llm_api_key:
        # Real LLM extraction is future work -- not wired here. Falling
        # through to the deterministic chunker rather than a stub result
        # dressed up as a model response.
        pass
    return {
        "used_llm": used_llm,
        "chunks": _deterministic_chunks(text),
        "note": (
            "No LLM configured (LLM_PROVIDER=none) -- this is a deterministic sentence "
            "split, not extracted work units. Each chunk is a literal substring of what "
            "you said; turn the ones that describe real work into Work Capture Grid rows "
            "yourself."
        ),
    }
