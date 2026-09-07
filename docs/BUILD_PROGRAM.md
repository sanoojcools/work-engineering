# Build program

**Work order:** [`docs/V10_BUILD.md`](V10_BUILD.md)

V10-1 **shipped:** #21 backend + #22 frontend. Next = **V10-2 BACKEND** (Claude). Cursor idle until that merge.

---

| Who | Slice | Status |
|---|---|---|
| **Claude Code** | **V10-2 pointers + resolver + 5 statuses (API only)** | **UNLOCKED** |
| Cursor | V10-2 Evidence UI (click claim) | LOCKED until this PR merges |
| V10-3 … 14 | — | locked |

Host/Render ignored until 30 Sep.

---

## V10-2 Claude (only unlocked)

One PR. Backend only. Do not edit Census Chart Plan UI (Cursor after).

- Pointer: file_id + page/line/cell on provenance (CSV/XLSX cell required; PDF = file-only honesty if no parser this PR)
- Resolver on write: open pointer; fail → field is not a fact, ConformanceGap + increment fabrication_count (tenant counter is enough; not a 12-metric dashboard)
- Five statuses: observed, declared, reconstructed, composed, predicted. Binding fields (authority, acceptance, constraints) remain declared+quote only — composed/predicted cannot bind.
- Reuse existing UploadedFile / provenance tables. No Darwinbox. No V10-3 verify-design.

Playwright: not required this PR (no UI). Backend tests: broken pointer cannot stay observed; binding field rejects predicted; RLS; guest/API 401.
HONESTY.md. Branch claude/v10-2 off latest main. PR → main. Squash-merge CI green. Stop. Do not start V10-3.

---

## Non-negotiables

Spec deny without evidence. Talk-only empty. 95 vs 61.8. Dual employment = stop. Fabricated ≠ Rashmi. Guest mints no key. `main` only.
