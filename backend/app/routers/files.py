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
from ..models.security import UploadedFile

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
        uploaded_by=key.label or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {"file_id": str(row.id), "sha256": row.sha256, "size": row.size_bytes, "file_name": row.file_name}
