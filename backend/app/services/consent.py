from __future__ import annotations

from ..models.security import ConsentReceipt
from ..schemas.consent import ConsentReceiptOut


def to_out(r: ConsentReceipt) -> ConsentReceiptOut:
    return ConsentReceiptOut(
        id=r.id,
        subject_id=r.interview_ref,
        purpose=r.purpose,
        consented_at=r.consent_timestamp,
        expires_at=r.auto_purge_at,
        status=r.status.value,
        revoked_at=r.revoked_at,
        purged_at=r.purged_at,
    )
