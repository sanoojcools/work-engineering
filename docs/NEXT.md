# NEXT — agents read this and execute their section

Fired 2026-09-08T12:30Z. Plan columns + outcome strip (#30) on main. Chart #28, Outcome #26, verify #25 shipped. Do not rebuild.

---

## Claude

**V10-5b BACKEND** — three-tier gaps (process / journey / outcome).

Reuse `conformance_gaps`. Additive column `tier` (default `process`). On import:
- undeclared / split-recommended / missing terminal → `process`
- missing handoff to the next desk in the Work System → `journey`
- Work System `outcome_records.status=not_measured` → one `outcome` gap (warn, never reject)
Never invent measured KPIs. No frontend. No NEXT.md edit.
Tests: three tiers on a real import; outcome gap while not_measured; RLS; GQS still the reject.
Branch `claude/v10-5b-gap-tiers`. PR → main. Stop.

If you are GitHub Action and cannot authenticate, fail the job with the error — do not no-op.

---

## Cursor

If #30 is not on main: stop.

**V10-6 Plan economics only.** `CensusPlan.tsx` (and Hours if already linked):
- Offer Desk: **95 stated / 61.8 defended**, both visible, never collapse to one number
- Other desks: **stated hours only** — do not invent defended
- One line: appetite does not lift dual-employment stop
Do not edit backend. Do not rebuild Chart 18-leaf or Plan columns.
Playwright: Plan still 95 and 61.8; guest 1→6.
Branch `cursor/v10-6-plan-econ` off latest main. PR → main as **Ready** (not Draft). Stop.
