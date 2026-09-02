"""V9 Slice C — persist honesty for the Offer Desk walk.

Talk-only (interviews, no sheet treated as traces) must call the existing
Scout generate → genome import → GQS path. This module wraps that gate.
It does not score GQS itself, does not invent observed provenance, and
does not write a parallel persist.

saved_count is rows actually written to work_units, not the payload size
GQS reports as work_unit_count. Completeness of an interview is not
permission to save.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..models.scout import ScoutInterviewSession
from ..models.workunit import WorkUnit
from . import scout_genome as genome_svc

COMPLETENESS_IS_NOT_CLEARANCE = "completeness_is_not_clearance"
SHEET_IS_DECLARED_NOT_OBSERVED = "sheet_is_declared_not_observed"


def persist_talk_only(
    db: Session,
    session: ScoutInterviewSession,
    *,
    actor: str,
    sheet_attached: bool = False,
) -> dict:
    """Persist the sitting through generate_genome / import_genome.

    sheet_attached means the Offer Desk workbook is treated as a careful
    interview note (declared ingest). It is not Zwayam and must not flip
    provenance to observed. Ratification stays unaccepted until traces exist.
    """
    result = genome_svc.generate_genome(db, session, actor=actor)

    saved_count = 0
    if result.get("accepted"):
        saved_count = (
            db.query(WorkUnit)
            .filter(WorkUnit.genome_version_id == result["version_id"])
            .count()
        )

    reasons: list[str] = [COMPLETENESS_IS_NOT_CLEARANCE]
    if sheet_attached:
        reasons.append(SHEET_IS_DECLARED_NOT_OBSERVED)
    if not result.get("accepted"):
        reasons.append("gqs_gate")
    for violation in result.get("violations") or []:
        if isinstance(violation, dict) and violation.get("code"):
            reasons.append(str(violation["code"]))

    return {
        **result,
        "saved_count": saved_count,
        "reasons": reasons,
        "talk_only": not sheet_attached,
        "sheet_attached": sheet_attached,
        "provenance": "declared",
        "ratification_accepted": False,
        "zwayam_events_claimed": 0,
    }
