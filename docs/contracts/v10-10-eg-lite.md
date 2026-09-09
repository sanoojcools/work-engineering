# V10-10 contract — EG-lite (backend only)

Claude implements **this file**. No extra product. No frontend.

Canon: a claim is only a fact if the cited file actually opens. V10-2 already opens CSV/XLSX **cells**. This slice adds **PDF page** open + a source catalogue that says **connected / not**. V10_CLOSE.md “V10-10 · EG-LITE + HARVEST”. Canon Part 2, thin.

Cursor will later put Employee / Offer / Contractor on the graph. **Not this PR.**

---

## Already on `main` (reuse, do not replace)

| Already there | Role |
|---|---|
| `field_pointers` + `services/pointers.py::resolve_pointer` | V10-2. CSV/XLSX cell open + quote substring. PDF is **file-only** today — that is the gap. |
| `UploadedFile.content` | Bytes. No second file store. |
| `BINDING_FIELDS` | `authority` / `acceptance_criteria` / `actor_constraints` — still `declared` + verified quote, else 422. |
| observed/reconstructed that fail to open | already downgrade to `predicted` + `GapKind.broken_pointer` + `fabrication_count`. Keep. |
| `GET /api/files` | lists files and what they back. Extend or add a sibling — do not invent a second file table. |
| `GET /api/work-units/{id}/pointers` | assertion ledger already. Do not duplicate. |

---

## 1. PDF page resolver

Add `pypdf` to `backend/requirements.txt` (pin a current 5.x). Use it only in `resolve_pointer`.

Rules, 1-based page numbers (page 1 = first page):

1. Cited file is a PDF (`file_name` ends `.pdf` **and** bytes start `%PDF-`). Else not resolved, with a plain note.
2. `page` is required for any PDF pointer that claims observed / reconstructed / declared-with-quote. File-only PDF remains allowed for **non-binding**, non-evidence statuses (same honesty as V10-2).
3. Extract text of that page. Empty page → not resolved (`"page N has no extractable text"`).
4. If `quote` is non-empty, it must be a **literal substring** of that page’s text (same rule as CSV cells). Else not resolved.
5. Out-of-range page → not resolved.
6. Binding fields: PDF **may** now bind if (2)+(4) hold. That is the point of this slice. If they do not hold → 422, never save a predicted binding field.

DOCX: **out of this PR** unless `python-docx` is already a dependency (it is not). Do not add a second new library. HONESTY.md: “DOCX page pointers not this PR.”

CSV/XLSX behaviour must not change. Existing `test_pointers.py` stays green.

---

## 2. Source catalogue — connected / not

`GET /api/evidence/catalogue` (keyed, 401 without key).

One row per **this tenant’s** `uploaded_files`:

```
{ id, file_name, coverage: "connected" | "not", pointer_count, resolved_count }
```

- `connected` = at least one `field_pointers` row with `file_id` = this file **and** `resolved` is true.
- `not` = zero resolved pointers (including files that back nothing, and files whose pointers all failed to open).
- Totals on the wrapper: `{ total, connected, not, items }`.
- Empty tenant → `{ total: 0, connected: 0, not: 0, items: [] }` — honest, not a demo pack.

Do **not** invent coverage %. Do not invent Darwinbox/Zwayam. Do not harvest mail.

Register under `/api/evidence` or extend the files router. Do not create `/api/census*`.

---

## Tests (real Postgres)

1. Upload a tiny real PDF (pypdf can write one in the test, or a fixture of a few hundred bytes). Pointer to page 1 with a quote that is on that page → `resolved=true`, quote verified. Binding field `authority` accepted as `declared`.
2. Same PDF, quote **not** on that page → not resolved. Binding → 422. observed → saved as `predicted` + broken_pointer gap.
3. Page 99 on a 1-page PDF → not resolved.
4. File named `.pdf` but bytes are not a PDF → not resolved (V10-2 already had this; keep).
5. CSV cell `B2` still opens (regression).
6. Catalogue: one connected file + one unused file → counts `connected=1`, `not=1`.
7. No key → 401. Tenant B cannot see tenant A’s files (RLS).
8. Full suite green. `alembic check` clean (this slice should not need a new table; if you add one, justify in HONESTY and chain from current head).

---

## Refuse

Frontend · Chart 18-leaf · Plan 95/61.8 · Gap UI · Sit close · Employee/Offer/Contractor graph nodes (Cursor, next) · Palantir ontology · DOCX extra library · mail harvest · coverage % · Darwinbox/Zwayam · login · V10-11 · lifting dual-employment stop · GQS changes · rewriting Rashmi rows

`docs/HONESTY.md` paragraph. Branch `claude/v10-10`. Ready PR → `main`. **Do not merge.** Stop.
