"""F1 (docs/BUILD_PROGRAM.md EVIDENCE-GAP): read-only view of this tenant's
uploaded files and what each one backs. No new store -- reads the existing
UploadedFile / WorkUnitProvenanceDetail tables Slice 1 PR 1a/1c already
write; this is the first endpoint that lists them back (see
test_file_upload_sha256.py's own note: "No GET /files endpoint in this
PR")."""
from datetime import datetime

from pydantic import BaseModel


class FileBackingOut(BaseModel):
    work_unit_code: str
    business_object: str
    claim: str


class UploadedFileOut(BaseModel):
    id: int
    file_name: str
    sha256: str
    content_type: str
    size_bytes: int
    uploaded_by: str
    uploaded_at: datetime
    # Empty means exactly what it says: no Work Unit's provenance cites this
    # file. Never padded with an invented backing to look more complete.
    backs: list[FileBackingOut] = []

    model_config = {"from_attributes": True}
