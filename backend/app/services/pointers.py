"""V10-2 (docs/V10_BUILD.md): resolver-on-write for field-level evidence
pointers. This is the module the whole slice is named after -- everything
else (model, schema, router) exists to get a claim to this function and
persist what it decides.

Core rule, stated in the work order because it is the point of the slice:
if a pointer cannot be opened, the field it backs is NOT a fact.

- `observed`/`reconstructed` are the two statuses that assert real,
  resolver-checkable evidence. A claim at either status whose file_id +
  page/line/cell will not open is downgraded to `predicted` -- never
  silently kept at a status it can no longer support -- and gets a
  ConformanceGap plus a bump to the tenant's fabrication_count
  (Client.fabrication_count, "not a 12-metric dashboard": one counter).
  `declared`/`composed`/`predicted` on a non-binding field make no such
  promise, so a pointer attempt that doesn't pan out under one of those
  statuses is recorded honestly (resolved=False, resolution_note set) but
  does not itself flip the status or raise a gap -- there was no
  evidence-claim for it to contradict.

- authority/acceptance_criteria/actor_constraints (BINDING_FIELDS) are
  narrower still: they may only stand as `declared`, with a non-empty
  quote the resolver has independently verified as a literal substring of
  the resolved cell -- same "checked against the source, never trusted"
  rule services/scout_story.py already applies to LLM-extracted spans. A
  binding write that doesn't clear that bar is REJECTED outright (422),
  never saved in a downgraded form: a binding field silently downgraded to
  "predicted" would still look bindable to a naive reader.

- PDF (or any format this PR has no parser for) resolves file-only: no
  page/line parser exists this PR, so the strongest honest claim is "this
  file exists and has content" -- never a verified quote. A binding field
  therefore cannot be satisfied by a PDF-sourced pointer this PR; it can
  still back a non-binding field as file-level evidence.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.client import Client
from ..models.discovery import ConformanceGap, GapKind
from ..models.pointers import FieldPointer, PointerStatus
from ..models.security import UploadedFile
from ..models.workunit import WorkUnit
from .classifier import rows_from_bytes

# The 18-attribute contract's substantive fields -- identity (code/name) and
# system-managed fields (status, autonomy_level, ...) are not pointer targets.
POINTERABLE_FIELDS = frozenset({
    "current_condition", "desired_condition", "context", "trigger", "inputs",
    "authority", "actor_constraints", "acceptance_criteria", "evidence_required",
    "verification_method", "sla_hours", "failure_semantics",
})

# WorkUnit's authority (9), acceptance_criteria (11), actor_constraints (10)
# -- the three fields V10_BUILD.md names as binding.
BINDING_FIELDS = frozenset({"authority", "acceptance_criteria", "actor_constraints"})

# Claims that assert resolver-checkable evidence -- see module docstring for
# why declared/composed/predicted are out of scope for the downgrade rule.
EVIDENCE_STATUSES = frozenset({PointerStatus.observed, PointerStatus.reconstructed})

_CSV_XLSX_EXTENSIONS = (".csv", ".xlsx")
_CELL_RE = re.compile(r"^([A-Za-z]+)(\d+)$")


@dataclass
class ResolveResult:
    resolved: bool
    note: str
    matched_text: str | None = None
    # True only when the resolver actually compared a quote against real
    # cell content (CSV/XLSX today). File-only resolution (PDF, or any
    # unparsed format) never sets this -- see module docstring.
    quote_verified: bool = False


def parse_cell_ref(cell: str) -> tuple[int, int] | None:
    """"B7" -> (row_index, col_index), both 0-based. None if not a valid
    Excel-style column-letters-then-row-digits reference."""
    m = _CELL_RE.match((cell or "").strip())
    if not m:
        return None
    letters, digits = m.groups()
    col = 0
    for ch in letters.upper():
        col = col * 26 + (ord(ch) - ord("A") + 1)
    row = int(digits) - 1
    if row < 0:
        return None
    return row, col - 1


def _extension(file_name: str) -> str:
    return f".{file_name.rsplit('.', 1)[-1].lower()}" if "." in file_name else ""


def resolve_pointer(
    file: UploadedFile | None,
    *,
    page: int | None,
    line: int | None,
    cell: str | None,
    quote: str,
) -> ResolveResult:
    """Try to actually open file_id + page/line/cell against the stored
    file. Never trusts the caller's claim: every branch either confirms the
    location exists (and, if a quote was offered, that the quote is really
    there) or explains in plain language why it could not."""
    if file is None:
        return ResolveResult(False, "no file cited")
    if file.content is None:
        return ResolveResult(False, "cited file has no stored content")

    ext = _extension(file.file_name)

    if ext in _CSV_XLSX_EXTENSIONS:
        if not cell:
            return ResolveResult(False, "CSV/XLSX pointers must give a cell (e.g. \"B7\")")
        parsed = parse_cell_ref(cell)
        if parsed is None:
            return ResolveResult(False, f"{cell!r} is not a valid cell reference")
        row_idx, col_idx = parsed
        try:
            rows = rows_from_bytes(file.content, file.file_name)
        except Exception as exc:  # genuinely corrupt bytes -- openpyxl/csv raised
            return ResolveResult(False, f"could not open file content: {exc}")
        if row_idx >= len(rows) or col_idx >= len(rows[row_idx]):
            return ResolveResult(False, f"cell {cell} is out of range for {file.file_name}")
        value = rows[row_idx][col_idx] or ""
        if quote and quote.strip():
            if quote.strip() not in value:
                return ResolveResult(False, f"quote not found at {cell} (cell reads {value!r})", matched_text=value)
            return ResolveResult(True, f"opened {cell}; quote verified", matched_text=value, quote_verified=True)
        return ResolveResult(True, f"opened {cell}", matched_text=value)

    # Everything else (PDF included): file-only honesty. No page/line parser
    # exists this PR (V10_BUILD.md: "PDF this PR = file-only, HONESTY if no
    # line parser") -- the strongest resolvable claim is "this file exists
    # and has content," never a specific page, line, or verified quote.
    if page is not None or line is not None or cell is not None:
        return ResolveResult(
            False, f"{ext or 'this file type'} has no page/line parser this PR — pointer must be file-only",
        )
    if ext == ".pdf" and not file.content.startswith(b"%PDF-"):
        return ResolveResult(False, "file is named .pdf but is not a valid PDF")
    return ResolveResult(True, "file-level only (no page/line parser this PR)")


def upsert_field_pointer(
    db: Session,
    work_unit: WorkUnit,
    *,
    field_name: str,
    requested_status: PointerStatus,
    file_id: int | None,
    page: int | None,
    line: int | None,
    cell: str | None,
    quote: str,
) -> FieldPointer:
    if field_name not in POINTERABLE_FIELDS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"{field_name!r} is not a pointerable field; expected one of {sorted(POINTERABLE_FIELDS)}",
        )

    file = db.get(UploadedFile, file_id) if file_id is not None else None
    if file_id is not None and file is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"UploadedFile {file_id} not found")

    result = resolve_pointer(file, page=page, line=line, cell=cell, quote=quote)
    is_binding = field_name in BINDING_FIELDS

    if is_binding:
        if requested_status != PointerStatus.declared:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{field_name} is a binding field: only 'declared' may bind, not {requested_status.value!r}",
            )
        if not quote.strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"{field_name} is a binding field: a quote is required",
            )
        if not result.resolved or not result.quote_verified:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{field_name} is a binding field: quote must be verified against an opened pointer "
                f"(CSV/XLSX only this PR) — {result.note}",
            )
        final_status = PointerStatus.declared
    else:
        final_status = requested_status
        if requested_status in EVIDENCE_STATUSES and not result.resolved:
            final_status = PointerStatus.predicted

    gap: ConformanceGap | None = None
    if final_status != requested_status:
        gap = ConformanceGap(
            kind=GapKind.broken_pointer,
            severity="P2",
            description=(
                f"{work_unit.code}.{field_name} claimed {requested_status.value} but its pointer "
                f"could not be opened: {result.note}"
            ),
            declared_ref=f"{work_unit.code}:{field_name}",
            work_unit_id=work_unit.id,
            client_id=work_unit.client_id,
        )
        db.add(gap)
        db.flush()
        client = db.get(Client, work_unit.client_id)
        client.fabrication_count = (client.fabrication_count or 0) + 1

    row = (
        db.query(FieldPointer)
        .filter(FieldPointer.work_unit_id == work_unit.id, FieldPointer.field_name == field_name)
        .one_or_none()
    )
    if row is None:
        row = FieldPointer(work_unit_id=work_unit.id, field_name=field_name)
    row.requested_status = requested_status
    row.status = final_status
    row.file_id = file_id
    row.page = page
    row.line = line
    row.cell = cell
    row.quote = quote
    row.resolved = result.resolved
    row.resolution_note = result.note
    row.gap_id = gap.id if gap is not None else None
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
