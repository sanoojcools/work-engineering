"""Elevation 2: Contradiction Resolver. Deterministic text-diff across a
function_head-type session's units and an sme-type session's units for the
same client -- no LLM, no sentiment model, just "do these two answers for
the same-named unit disagree." Confidence is not a measured statistic; see
ScoutContradiction.confidence's docstring.

Still exactly two-way (function_head vs sme) after the three-layer
interview model added sub_function_lead: that pairing is the widest gap --
strategic account vs. operational account -- and is what this elevation
was built and tested against. Folding sub_function_lead in (three-way
comparison, or a middle-tier-vs-either-neighbor comparison) is new scope,
not requested alongside the rename, and left for a deliberate follow-up
rather than done implicitly here.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.scout import (
    ContradictionStatus,
    InterviewType,
    ScoutCapturedUnit,
    ScoutContradiction,
    ScoutInterviewSession,
)

COMPARED_FIELDS = ("systems", "frequency", "inputs")


def _norm(text: str) -> str:
    return text.strip().lower()


def detect_and_upsert(db: Session, client_id: int) -> list[ScoutContradiction]:
    sessions = (
        db.query(ScoutInterviewSession)
        .filter(ScoutInterviewSession.client_id == client_id)
        .all()
    )
    founder_sessions = [s for s in sessions if s.type == InterviewType.function_head]
    sme_sessions = [s for s in sessions if s.type == InterviewType.sme]
    if not founder_sessions or not sme_sessions:
        return []

    def units_by_name(sessions_: list[ScoutInterviewSession]) -> dict[str, tuple[ScoutInterviewSession, ScoutCapturedUnit]]:
        out: dict[str, tuple[ScoutInterviewSession, ScoutCapturedUnit]] = {}
        for s in sessions_:
            for u in s.units:
                key = _norm(u.name)
                if key and key not in out:  # first mention wins, deterministic order by session id
                    out[key] = (s, u)
        return out

    founder_units = units_by_name(founder_sessions)
    sme_units = units_by_name(sme_sessions)

    existing = {
        (c.unit_name, c.field): c
        for c in db.query(ScoutContradiction).filter(ScoutContradiction.client_id == client_id).all()
    }

    created: list[ScoutContradiction] = []
    for key, (f_session, f_unit) in founder_units.items():
        if key not in sme_units:
            continue
        s_session, s_unit = sme_units[key]
        for field in COMPARED_FIELDS:
            f_text = _norm(getattr(f_unit, field))
            s_text = _norm(getattr(s_unit, field))
            if not f_text or not s_text or f_text == s_text:
                continue
            record_key = (f_unit.name, field)
            if record_key in existing:
                continue  # already flagged (or resolved) -- don't re-raise a resolved one silently
            row = ScoutContradiction(
                client_id=client_id,
                unit_name=f_unit.name,
                field=field,
                founder_session_id=f_session.id,
                sme_session_id=s_session.id,
                founder_text=getattr(f_unit, field),
                sme_text=getattr(s_unit, field),
                confidence=1.0,
                status=ContradictionStatus.open,
            )
            db.add(row)
            created.append(row)
    if created:
        db.flush()
    return created
