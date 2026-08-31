"""D1–D3: discovery. LLM assist degrades to a deterministic splitter without a key."""
from __future__ import annotations

import json
import re

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from . import llm
from ..models.discovery import (
    CandidateStatus,
    ConformanceGap,
    DiscoveryCandidate,
    GapKind,
    IntentKind,
    IntentSource,
    Origin,
    TraceEvent,
)
from ..models.ontology import EntityKind, EntityType, Provenance
from ..models.workunit import ActorType, UnitStatus, VerificationMethod, WorkUnit
from ..services.errors import ConflictError, RuleError
from ..services.work_units import create_unit
from ..services.tenants import get_or_create_catalog
from ..schemas.workunit import WorkUnitCreate

BIAS_NOTE = "Declared intent only — tacit and exception work is under-sampled."


def suggest_candidates(text: str, origin: Origin) -> list[dict]:
    items: list[dict] = []
    if settings.llm_provider != "none" and settings.llm_api_key:
        prompt = (
            "Extract candidate Work Units from the following operational text. "
            "Each candidate is an independently accountable commitment to move one "
            "business object from a current condition to a desired condition. "
            "Return JSON list of objects with keys: name, business_object, "
            "current_condition, desired_condition, notes.\n\n" + text
        )
        try:
            body = _openai(prompt) if settings.llm_provider == "openai" else llm.complete(prompt)
            items = _parse_candidates(body, origin)
        except Exception:
            items = []
    if not items:
        items = split_text(text, origin)
    return items


def persist_intake(
    db: Session,
    text: str,
    origin: Origin,
    title: str,
    kind: IntentKind,
    client_id: int | None = None,
) -> tuple[IntentSource, list[DiscoveryCandidate]]:
    from .tenants import get_or_create_catalog
    cid = client_id or get_or_create_catalog(db).id
    intent = IntentSource(
        kind=kind,
        title=(title or text[:80] or "Intake")[:200],
        body=text,
        provenance=Provenance.declared if origin == Origin.downward else Provenance.observed,
        client_id=cid,
    )
    db.add(intent)
    db.flush()
    raw = suggest_candidates(text, origin)
    rows: list[DiscoveryCandidate] = []
    for item in raw:
        payload = item.get("payload") or "{}"
        parsed = _payload_dict(payload)
        if parsed.get("business_object"):
            ensure_type(db, str(parsed["business_object"]))
        row = DiscoveryCandidate(
            name=item["name"][:200],
            origin=origin,
            provenance=Provenance.declared if origin == Origin.downward else Provenance.inferred,
            payload=payload if isinstance(payload, str) else json.dumps(payload),
            sampling_bias_note=BIAS_NOTE if origin == Origin.downward else "",
            status=CandidateStatus.new,
            client_id=intent.client_id,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    db.refresh(intent)
    for row in rows:
        db.refresh(row)
    return intent, rows


def split_text(text: str, origin: Origin) -> list[dict]:
    lines = [ln.strip(" \t-•*") for ln in text.splitlines()]
    chunks = [ln for ln in lines if ln and not _header_only(ln)]
    numbered = [re.sub(r"^\d+[.)]\s*", "", ln) for ln in chunks]
    numbered = [ln for ln in numbered if ln]
    source = numbered or ([text.strip()] if text.strip() else [])
    out: list[dict] = []
    for line in source:
        if "\t" in line or (line.count(",") >= 3 and not line.startswith("http")):
            parts = [p.strip() for p in re.split(r"\t|,", line) if p.strip()]
            name = parts[0] if parts else line
            payload = {
                "name": name,
                "business_object": parts[1] if len(parts) > 1 else "Employee",
                "current_condition": parts[2] if len(parts) > 2 else "",
                "desired_condition": parts[3] if len(parts) > 3 else "",
                "notes": line,
            }
        else:
            payload = {
                "name": line[:200],
                "business_object": "Employee",
                "current_condition": "",
                "desired_condition": "",
                "notes": line,
            }
        out.append({
            "name": payload["name"],
            "origin": origin.value,
            "provenance": Provenance.declared.value if origin == Origin.downward else Provenance.inferred.value,
            "payload": json.dumps(payload),
        })
    return out


def ensure_type(db: Session, name: str) -> EntityType:
    key = name.strip() or "Employee"
    row = db.query(EntityType).filter(EntityType.name.ilike(key)).one_or_none()
    if row:
        return row
    row = EntityType(
        name=key[:120],
        kind=EntityKind.business_object,
        description=f"{key} (discovery intake)",
        state_machine='["draft","active","done"]',
    )
    db.add(row)
    db.flush()
    return row


def reject_candidate(db: Session, row: DiscoveryCandidate) -> DiscoveryCandidate:
    row.status = CandidateStatus.rejected
    db.commit()
    db.refresh(row)
    return row


def accept_candidate(db: Session, row: DiscoveryCandidate) -> WorkUnit:
    if row.status != CandidateStatus.new:
        raise RuleError("Only new candidates can be accepted")
    data = _payload_dict(row.payload)
    type_row = ensure_type(db, str(data.get("business_object") or "Employee"))
    code = f"WU-DISC-{row.id}"
    current = _clip(str(data.get("current_condition") or "TBD"), 80)
    desired = _clip(str(data.get("desired_condition") or "TBD"), 80)
    payload = WorkUnitCreate(
        code=code,
        name=_clip(row.name, 200),
        business_object_type_id=type_row.id,
        current_condition=current,
        desired_condition=desired,
        context=str(data.get("notes") or "Discovered from declared intent"),
        trigger=current,
        inputs=str(data.get("business_object") or "Employee"),
        authority="TBD",
        actor_constraints="human",
        acceptance_criteria=str(data.get("acceptance_criteria") or "TBD"),
        evidence_required=str(data.get("evidence") or "TBD"),
        verification_method=VerificationMethod.deterministic_rule,
        sla_hours=8,
        failure_semantics="Hold; notify owner; do not silently retry",
        provenance=Provenance.inferred,
        owner=str(data.get("owner") or "TBD"),
        actor_type=ActorType.human,
        client_id=row.client_id,
    )
    try:
        wu = create_unit(db, payload)
    except ConflictError:
        payload.code = f"WU-DISC-{row.id}-{wu_suffix(db)}"
        wu = create_unit(db, payload)
    wu.status = UnitStatus.draft
    row.status = CandidateStatus.merged
    row.work_unit_id = wu.id
    db.commit()
    db.refresh(wu)
    db.refresh(row)
    return wu


def merge_candidate(db: Session, row: DiscoveryCandidate, work_unit_id: int) -> DiscoveryCandidate:
    wu = db.get(WorkUnit, work_unit_id)
    if wu is None:
        raise RuleError(f"Work Unit {work_unit_id} not found")
    row.status = CandidateStatus.merged
    row.work_unit_id = wu.id
    db.commit()
    db.refresh(row)
    return row


def scan_gaps(db: Session, client_id: int | None = None) -> list[ConformanceGap]:
    q = db.query(ConformanceGap)
    units_q = db.query(WorkUnit)
    intents_q = db.query(IntentSource)
    cand_q = db.query(DiscoveryCandidate).filter(DiscoveryCandidate.status == CandidateStatus.new)
    if client_id is not None:
        q = q.filter(ConformanceGap.client_id == client_id)
        units_q = units_q.filter(WorkUnit.client_id == client_id)
        intents_q = intents_q.filter(IntentSource.client_id == client_id)
        cand_q = cand_q.filter(DiscoveryCandidate.client_id == client_id)
    q.delete(synchronize_session=False)
    db.flush()
    created: list[ConformanceGap] = []
    units = units_q.all()
    intents = intents_q.all()
    candidates = cand_q.all()
    traces = [] if client_id is not None else db.query(TraceEvent).all()

    unit_keys = {_norm(u.name) for u in units}

    for intent in intents:
        if not _intent_matches_unit(intent, units):
            created.append(ConformanceGap(
                kind=GapKind.unimplemented,
                description=f"Declared intent '{intent.title}' has no matching Work Unit on object, owner, or acceptance.",
                declared_ref=intent.title,
                discovered_ref="",
            ))

    for candidate in candidates:
        if _norm(candidate.name) not in unit_keys:
            created.append(ConformanceGap(
                kind=GapKind.undeclared,
                description=f"Candidate '{candidate.name}' is not in the Work Unit inventory (shadow / undeclared work).",
                discovered_ref=candidate.name,
                declared_ref="",
            ))

    if traces:
        for trace in traces:
            ref = trace.object_ref or f"trace-{trace.id}"
            hay = _norm(f"{trace.object_ref} {trace.payload}")
            if hay and not any(_norm(u.name) in hay or _norm(u.code) in hay for u in units):
                created.append(ConformanceGap(
                    kind=GapKind.undeclared,
                    description=f"Trace '{ref}' has no declared Work Unit.",
                    discovered_ref=ref,
                    declared_ref="",
                ))

    for wu in units:
        if not (wu.acceptance_criteria or "").strip() or not (wu.evidence_required or "").strip() \
                or wu.acceptance_criteria.strip().upper() == "TBD" or wu.evidence_required.strip().upper() == "TBD":
            created.append(ConformanceGap(
                kind=GapKind.missing_acceptance,
                description=f"{wu.code} is missing acceptance criteria or evidence.",
                declared_ref=wu.code,
                discovered_ref="",
                work_unit_id=wu.id,
            ))

    by_name: dict[str, list[WorkUnit]] = {}
    for wu in units:
        by_name.setdefault(_norm(wu.name), []).append(wu)
    for name, group in by_name.items():
        if len(group) < 2:
            continue
        owners = { _norm(u.owner) for u in group }
        desired = { _norm(u.desired_condition) for u in group }
        if len(owners) > 1:
            created.append(ConformanceGap(
                kind=GapKind.policy_violation,
                description=f"Units named '{group[0].name}' have different owners ({', '.join(u.owner or '—' for u in group)}).",
                declared_ref=group[0].code,
                discovered_ref=group[1].code,
                work_unit_id=group[0].id,
            ))
        elif len(desired) > 1:
            created.append(ConformanceGap(
                kind=GapKind.workaround,
                description=f"Units named '{group[0].name}' disagree on desired condition.",
                declared_ref=group[0].code,
                discovered_ref=group[1].code,
                work_unit_id=group[0].id,
            ))

    for row in created:
        row.client_id = client_id
    db.add_all(created)
    db.commit()
    for gap in created:
        db.refresh(gap)
    return created


def _intent_matches_unit(intent: IntentSource, units: list[WorkUnit]) -> bool:
    hay = _norm(f"{intent.title} {intent.body}")
    for wu in units:
        if _norm(wu.name) and _norm(wu.name) in hay:
            return True
        if _norm(wu.code) and _norm(wu.code) in hay:
            return True
        if wu.owner and _norm(wu.owner) in hay:
            return True
        if wu.acceptance_criteria and _norm(wu.acceptance_criteria)[:20] in hay:
            return True
    return False


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _clip(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[:limit]


def _payload_dict(payload: str) -> dict:
    try:
        data = json.loads(payload or "{}")
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def wu_suffix(db: Session) -> int:
    return (db.query(WorkUnit).count() or 0) + 1


def _header_only(line: str) -> bool:
    return line.lower() in {"code", "title", "name", "work units"}


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
