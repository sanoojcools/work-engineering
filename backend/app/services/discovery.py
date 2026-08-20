"""D1–D3: discovery. LLM assist degrades to import-only without a key."""
from __future__ import annotations

import json

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..models.discovery import (
    CandidateStatus,
    ConformanceGap,
    DiscoveryCandidate,
    GapKind,
    IntentSource,
    Origin,
)
from ..models.ontology import Provenance
from ..models.workunit import WorkUnit


def suggest_candidates(text: str, origin: Origin) -> list[dict]:
    if settings.llm_provider == "none" or not settings.llm_api_key:
        return []
    prompt = (
        "Extract candidate Work Units from the following operational text. "
        "Each candidate is an independently accountable commitment to move one "
        "business object from a current condition to a desired condition. "
        "Return JSON list of objects with keys: name, business_object, "
        "current_condition, desired_condition, notes.\n\n" + text
    )
    try:
        if settings.llm_provider == "anthropic":
            body = _anthropic(prompt)
        else:
            body = _openai(prompt)
    except Exception:
        return []
    return _parse_candidates(body, origin)


def scan_gaps(db: Session) -> list[ConformanceGap]:
    """Cheap census: declared intent titles with no matching work unit or candidate."""
    created: list[ConformanceGap] = []
    unit_names = {u.name.lower() for u in db.query(WorkUnit).all()}
    cand_names = {c.name.lower() for c in db.query(DiscoveryCandidate).all()}
    for intent in db.query(IntentSource).all():
        haystack = f"{intent.title} {intent.body}".lower()
        matched = any(n and n in haystack for n in unit_names | cand_names)
        if matched:
            continue
        gap = ConformanceGap(
            kind=GapKind.unimplemented,
            description=f"Declared intent '{intent.title}' has no discovered or designed Work Unit",
            declared_ref=intent.title,
            discovered_ref="",
        )
        db.add(gap)
        created.append(gap)
    for candidate in db.query(DiscoveryCandidate).filter(
        DiscoveryCandidate.status == CandidateStatus.new
    ).all():
        if candidate.name.lower() in unit_names:
            continue
        gap = ConformanceGap(
            kind=GapKind.undeclared,
            description=f"Discovered candidate '{candidate.name}' is not in the Work Unit inventory",
            discovered_ref=candidate.name,
            declared_ref="",
        )
        db.add(gap)
        created.append(gap)
    db.commit()
    for gap in created:
        db.refresh(gap)
    return created


def _anthropic(prompt: str) -> str:
    response = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": settings.llm_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": settings.llm_model,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=30.0,
    )
    response.raise_for_status()
    content = response.json()["content"][0]["text"]
    return content


def _openai(prompt: str) -> str:
    response = httpx.post(
        f"{settings.llm_base_url.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {settings.llm_api_key}"},
        json={
            "model": settings.llm_model,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def _parse_candidates(body: str, origin: Origin) -> list[dict]:
    start = body.find("[")
    end = body.rfind("]")
    if start < 0 or end < 0:
        return []
    try:
        rows = json.loads(body[start : end + 1])
    except json.JSONDecodeError:
        return []
    out = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("name"):
            continue
        out.append({
            "name": row["name"],
            "origin": origin.value,
            "provenance": Provenance.inferred.value,
            "payload": json.dumps(row),
        })
    return out
