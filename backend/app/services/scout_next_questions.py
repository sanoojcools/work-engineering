"""SITTING-STEER backend: GET /api/scout/sessions/{id}/next-questions.

Reads packs/hr/question_bank.yaml verbatim -- no LLM, no invented question.
Seat lock (hard): a session's `type` pins it to exactly its own track, and
within that track to the one fixed field -> question mapping below. This is
the whole seat-lock rule spelled out as data rather than as a generic
"attributes include this field" scan, because that generic scan would (by
coincidence of the pack's own authoring) still produce the identical
mapping -- being explicit here means a future edit to the pack can't
silently leak a cross-track question (e.g. sme's s3 showing up on a
function_head session) the way a scan over `attributes` could.

Never dual-employment: that stop lives entirely in services/handoff.py and
is not one of this pack's tracked binding fields, so nothing here can ever
surface a dual-employment question -- there isn't one in the yaml to find.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.scout import ScoutInterviewSession
from ..models.workunit import WorkUnit

QUESTION_BANK_PATH = Path(__file__).resolve().parents[3] / "packs" / "hr" / "question_bank.yaml"

# seat -> {binding field -> the one pack question id that closes it, in that
# seat's own track}. sme is the only seat with two, matching the pack itself
# (s1 for desired_condition, s3 for acceptance_criteria) -- see
# packs/hr/question_bank.yaml.
SEAT_FIELD_QUESTIONS: dict[str, dict[str, str]] = {
    "function_head": {"authority": "f3"},
    "sub_function_lead": {"authority": "l1"},
    "sme": {"desired_condition": "s1", "acceptance_criteria": "s3"},
}


def _load_pack() -> dict[str, Any]:
    with open(QUESTION_BANK_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _question(pack: dict[str, Any], seat: str, question_id: str) -> dict[str, Any] | None:
    for q in pack.get("tracks", {}).get(seat, []):
        if q.get("id") == question_id:
            return q
    return None


def _is_empty(value: str | None) -> bool:
    return value is None or not value.strip()


def _offer_desk_pieces(db: Session, session: ScoutInterviewSession) -> list[WorkUnit]:
    """This tenant's Offer Desk genome pieces (WU-OD-*) plus whatever this
    one session's own captured units have already produced via
    generate-genome (WU-SCOUT-{unit.id}, services/scout_genome.py::_wu_id).
    RLS (app.current_client_id, set by TenantDbDep) already scopes this
    query to the caller's own tenant, same as every other query in this
    router -- no explicit client_id filter needed or added here."""
    scout_codes = [f"WU-SCOUT-{u.id}"[:40] for u in session.units]
    return (
        db.query(WorkUnit)
        .filter(or_(WorkUnit.code.like("WU-OD-%"), WorkUnit.code.in_(scout_codes)))
        .order_by(WorkUnit.code)
        .all()
    )


def build_next_questions(db: Session, session: ScoutInterviewSession) -> list[dict[str, Any]]:
    seat = session.type.value
    field_map = SEAT_FIELD_QUESTIONS.get(seat, {})
    if not field_map:
        return []
    pack = _load_pack()
    out: list[dict[str, Any]] = []
    for piece in _offer_desk_pieces(db, session):
        for field_name, question_id in field_map.items():
            if not _is_empty(getattr(piece, field_name)):
                continue
            question = _question(pack, seat, question_id)
            if question is None:
                continue
            out.append({
                "field": field_name,
                "seat": seat,
                "pack_id": question["id"],
                "text": question["text"],
                "why": question["why"],
                "piece_code": piece.code,
            })
    return out
