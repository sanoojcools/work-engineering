"""V10-1 BACKEND (docs/V10_BUILD.md): readiness booleans + Census
(de)serialization.

Three signals, each read from an EXISTING table -- consent_receipts,
scout_interview_sessions, uploaded_files -- never a fabricated
document-request/received-files workflow ("Wire consent + 3 seats + 'docs
asked' as booleans from existing data (do not fake received files)").

All three source tables are client-scoped, not work-system-scoped (none of
them carries a work_system_id column), so readiness reflects the whole
tenant rather than just the one census's journey -- honest given today's
schema, not a limitation invented by this slice.

"3 seats" (README.md, CensusCapture.tsx) means one scout_interview_session
of each of the three InterviewType values (function_head, sub_function_lead,
sme) -- not merely three sessions of any type."""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from ..models.censuses import Census
from ..models.scout import InterviewType, ScoutInterviewSession
from ..models.security import ConsentReceipt, ConsentStatus, UploadedFile
from ..schemas.censuses import CensusOut, ReadinessOut

SEAT_TYPES = (InterviewType.function_head, InterviewType.sub_function_lead, InterviewType.sme)


def compute_readiness(db: Session, client_id: int) -> ReadinessOut:
    consent_count = (
        db.query(ConsentReceipt)
        .filter(ConsentReceipt.client_id == client_id, ConsentReceipt.status == ConsentStatus.active)
        .count()
    )
    seat_types_present = {
        row[0]
        for row in db.query(ScoutInterviewSession.type)
        .filter(ScoutInterviewSession.client_id == client_id)
        .distinct()
        .all()
    }
    seats_filled = len(seat_types_present.intersection(SEAT_TYPES))
    docs_count = db.query(UploadedFile).filter(UploadedFile.client_id == client_id).count()

    return ReadinessOut(
        consent=consent_count > 0,
        consent_receipt_count=consent_count,
        people=seats_filled >= len(SEAT_TYPES),
        people_seats_filled=seats_filled,
        people_seats_total=len(SEAT_TYPES),
        docs=docs_count > 0,
        docs_uploaded_count=docs_count,
    )


def to_out(db: Session, row: Census) -> CensusOut:
    return CensusOut(
        id=row.id,
        client_id=row.client_id,
        work_system_id=row.work_system_id,
        status=row.status.value,
        scope=json.loads(row.scope or "{}"),
        document_requests=json.loads(row.document_requests or "[]"),
        created_at=row.created_at,
        updated_at=row.updated_at,
        started_at=row.started_at,
        readiness=compute_readiness(db, row.client_id),
    )
