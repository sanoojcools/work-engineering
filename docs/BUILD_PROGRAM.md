# Build program

**Work order:** [`docs/V10_BUILD.md`](V10_BUILD.md)

V10-1 shipped. V10-2 backend #23 shipped. **V10-2 UI = PR #24** (merge when CI green, then this unlock applies).

---

| Who | Slice | Status |
|---|---|---|
| Cursor | V10-2 Evidence UI | **#24 — merge when green, then idle** |
| **Claude** | **V10-3 verify + certify + 5th gate (backend)** | **UNLOCKED after #24 is on main** |
| Cursor | V10-3 Plan columns | LOCKED until Claude V10-3 merges |
| V10-4 … | Chart 18-leaf | locked |

---

## V10-3 Claude (backend only)

Do not edit CensusEvidence / Chart pages.

Per unit on the offer→Day-1 journey:
- verification_design: method (one of seven or none), independent? (different lineage / deterministic / no), sampling, cost or “not stated”
- Certification **separate** from provenance: sure / mostly sure / reported not seen / cannot define
- 5th gate: non-waivable from confirmed intent; error-cost = contestable default
- Dual-employment stop still unliftable at ambitious
- Handoff **Not ready** if independence required and missing
- Dual-track flag stored: do may be delegated, check stays human — no executor

Tests: offer-release Not ready without independent check; predicted provenance cannot become “sure”; dual-employment still stop; RLS.
HONESTY.md. Branch claude/v10-3. PR → main. Squash-merge CI green. Stop. No V10-4.

---

## Non-negotiables

Spec deny. Talk-only empty. 95 vs 61.8. Dual employment = stop. Fabricated ≠ Rashmi. Guest mints no key.
