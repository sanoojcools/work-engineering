"""Slice 1 PR 1a (playbook E.1): real file upload + server-computed sha256.

This is the missing Stage 4 primitive. Until this endpoint existed, every
provenance.hash_sha256 anywhere in the system was caller-supplied, which
made the "tamper-evident" claim false. This PR does not parse file content —
that's PR 1b (classifier) and 1c (Track A mapper).
"""
from __future__ import annotations

import hashlib
from pathlib import PurePosixPath

from fastapi import APIRouter, HTTPException, UploadFile, status

from ..dependencies import OrgKeyDep, TenantDbDep
from ..models.security import ReviewQueueItem, ReviewQueueStatus, UploadedFile
from ..services.classifier import classify
from ..services.lookup import get_or_404

router = APIRouter()

# Explicit, documented, tested cap (playbook E.1.1) — not a silent drop.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MiB
ALLOWED_EXTENSIONS = {".csv", ".xlsx"}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile, db: TenantDbDep, key: OrgKeyDep) -> dict:
    name = PurePosixPath(file.filename or "").name  # basename only, strip any path
    ext = PurePosixPath(name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported file type {ext!r}; expected one of {sorted(ALLOWED_EXTENSIONS)}",
        )

    body = await file.read()
    if not body:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"File exceeds {MAX_UPLOAD_BYTES} byte cap")

    sha256 = hashlib.sha256(body).hexdigest()

    row = UploadedFile(
        client_id=key.client_id,
        file_name=name,
        sha256=sha256,
        content_type=file.content_type or "",
        size_bytes=len(body),
        content=body,
        uploaded_by=key.label or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {"file_id": str(row.id), "sha256": row.sha256, "size": row.size_bytes, "file_name": row.file_name}


@router.post("/{file_id}/classify")
def classify_file(file_id: int, db: TenantDbDep, key: OrgKeyDep) -> dict:
    """Slice 1 PR 1b: format classifier. Never calls the import service —
    this only scores the header row and queues the file if nothing scores
    >= 0.7 (playbook: a File-6-class sheet must never become a genome)."""
    row = get_or_404(db, UploadedFile, file_id, "UploadedFile")
    if row.content is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File has no stored content to classify")

    result = classify(row.content, row.file_name)

    if result.queued:
        item = ReviewQueueItem(
            client_id=key.client_id,
            file_id=row.id,
            row_ref=None,
            col_ref="",
            raw_text="",
            confidence=0.0,
            reason="unrecognized_step_column",
            status=ReviewQueueStatus.pending,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return {
            "queued": True,
            "review_queue_item_id": item.id,
            "reason": "unrecognized_step_column",
            "metadata_notes": result.metadata_notes,
        }

    return {
        "queued": False,
        "header_row_index": result.header_row_index,
        "step_identity_column": result.step_identity_column,
        "step_identity_confidence": result.step_identity_confidence,
        "header_cells": result.header_cells,
        "metadata_notes": result.metadata_notes,
    }
