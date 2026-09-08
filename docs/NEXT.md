# NEXT — agents read this and execute their section

Factory repair 2026-09-08T13:00Z. V10-6 Plan economics is on main. Do not rebuild Chart, Plan columns, or 95/61.8.

---

## Claude

**V10-5b BACKEND** — three-tier gaps (process / journey / outcome).

Reuse `conformance_gaps`. Additive column `tier` (default `process`). On import:
- undeclared / split-recommended / missing terminal → `process`
- missing handoff to the next desk in the Work System → `journey`
- Work System `outcome_records.status=not_measured` → one `outcome` gap (warn, never reject)
Never invent measured KPIs. No frontend. No NEXT.md edit.
Tests: three tiers on a real import; outcome gap while not_measured; RLS; GQS still the reject.
Branch `claude/v10-5b-gap-tiers`. PR → main as Ready (never Draft). Stop.

---

## Cursor

**LOCKED.** V10-6 shipped. If you are a cloud run from this push: stop. No feature PR.
