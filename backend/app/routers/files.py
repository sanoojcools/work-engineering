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
from ..services.genome_import import import_genome
from ..services.lookup import get_or_404
from ..services.track_a import find_orphan_dependencies, map_track_a

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


@router.post("/{file_id}/map-track-a")
def map_track_a_endpoint(
    file_id: int, db: TenantDbDep, key: OrgKeyDep, dual_scoring_kappa: float | None = None,
) -> dict:
    """Slice 1 PR 1c: deterministic Track A mapping, handed to the EXISTING
    GQS + import pipeline unchanged. Every row/file that can't be mapped
    deterministically queues instead of guessing (playbook: "prefer queue
    the row"). Orphan dependencies are made visible via review_queue
    regardless of whether the batch ultimately clears the GQS gate."""
    row = get_or_404(db, UploadedFile, file_id, "UploadedFile")
    if row.content is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File has no stored content to map")

    result = map_track_a(row.content, row.file_name, uploaded_file_id=row.id, file_sha256=row.sha256)

    if result.queued_whole_file:
        item = ReviewQueueItem(
            client_id=key.client_id, file_id=row.id, row_ref=None, col_ref="", raw_text="",
            confidence=0.0, reason=result.reason, status=ReviewQueueStatus.pending,
        )
        db.add(item)
        db.commit()
        return {"queued_whole_file": True, "reason": result.reason, "work_unit_count": 0}

    for qr in result.queued_rows:
        db.add(ReviewQueueItem(
            client_id=key.client_id, file_id=row.id, row_ref=qr.row_index, col_ref="", raw_text="",
            confidence=0.0, reason=qr.reason, status=ReviewQueueStatus.pending,
        ))

    orphans = find_orphan_dependencies(result.work_units)
    for o in orphans:
        db.add(ReviewQueueItem(
            client_id=key.client_id, file_id=row.id, row_ref=o["row"], col_ref="",
            raw_text=f"dependency={o['dependency_id']} from_wu={o['wu_id']}",
            confidence=0.0, reason="orphan_dependency", status=ReviewQueueStatus.pending,
        ))
    db.commit()

    if not result.work_units:
        return {
            "queued_whole_file": False, "work_unit_count": 0,
            "rows_queued": len(result.queued_rows), "orphans_flagged": len(orphans),
        }

    payload = {"work_units": result.work_units}
    if dual_scoring_kappa is not None:
        # Caller-supplied, same as the JSON-body import path — Track A does
        # not measure kappa, it only forwards what was given (playbook:
        # "do not fake kappa").
        payload["dual_scoring_kappa"] = dual_scoring_kappa
    import_result = import_genome(
        db, key.client_id, payload,
        actor=key.label or f"org_api_key:{key.id}",
    )
    return {
        "queued_whole_file": False,
        "rows_mapped": len(result.work_units),
        "rows_queued": len(result.queued_rows),
        "orphans_flagged": len(orphans),
        "import_result": import_result,
    }
