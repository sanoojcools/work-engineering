"""P0: PII classification + pgcrypto field-level encryption + redaction.

Scope, honestly: this catches STRUCTURED PII (email, phone, UAN-shaped
numbers) via regex, matching what a lightweight scanner without NER can
reliably do. It does NOT detect free-text personal names embedded in prose
(e.g. "Rashmi KN can initiate" in authority) — that needs NLP entity
recognition, out of scope for this pass. The name-scrub for the sample
genome (services/gqs.py's test fixtures) was done separately, by hand, with
a known name list — this scanner is the general-purpose runtime path for
genomes Scout hasn't seen the interview roster for.
"""
from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..models.security import PiiFieldValue

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s-]?)?\d{10}(?!\d)")
UAN_RE = re.compile(r"\bUAN[\s:#-]*\d{10,12}\b", re.IGNORECASE)

# Fields most likely to carry PII per the CLAUDE_CODE_BUILD_READY_v0.5
# classification: Input, Evidence Required, Authority, Actor Constraints.
PII_CANDIDATE_FIELDS = ("input", "evidence_required", "authority", "actor_constraints")


def classify(value: str) -> str | None:
    if EMAIL_RE.search(value):
        return "email"
    if UAN_RE.search(value):
        return "uan"
    if PHONE_RE.search(value):
        return "phone"
    return None


def redact(value: str) -> str:
    return (value[:3] + "***") if len(value) > 3 else "***"


def scan_and_store_pii(db: Session, work_unit_id: int, fields: dict[str, str]) -> list[str]:
    """fields: {field_name: text_value} for the candidate PII fields on one
    Work Unit. Encrypts each PII hit via pgcrypto and stores the encrypted
    value + a redacted preview; returns the list of field names flagged."""
    flagged: list[str] = []
    for field_name, value in fields.items():
        if not value:
            continue
        pii_type = classify(value)
        if not pii_type:
            continue
        flagged.append(field_name)
        row = db.execute(
            text("SELECT pgp_sym_encrypt(:val, :key) AS enc"),
            {"val": value, "key": settings.pii_encryption_key},
        ).one()
        db.add(PiiFieldValue(
            work_unit_id=work_unit_id,
            field_name=field_name,
            pii_type=pii_type,
            encrypted_value=row.enc,
            redacted_preview=redact(value),
        ))
    return flagged


def decrypt_pii(db: Session, pii_row: PiiFieldValue) -> str:
    """Full plaintext — callers MUST enforce role=PIIViewer before invoking
    this; this function itself does no authorization, only decryption."""
    result = db.execute(
        text("SELECT pgp_sym_decrypt(:enc, :key) AS val"),
        {"enc": pii_row.encrypted_value, "key": settings.pii_encryption_key},
    ).one()
    return result.val
