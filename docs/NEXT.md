# NEXT — agents read this and execute their section

Fired 2026-09-08T10:33Z. V10-3 law #25, Outcome table #26, Chart 18-leaf #28 — shipped. Do not rebuild them.

---

## Claude

**V10-5b BACKEND** — three-tier gaps (process / journey / outcome).

Reuse `conformance_gaps`. Additive column `tier` (default `process`). On import:
- undeclared twin / split-recommended / missing terminal → `process`
- missing handoff to the next desk in the Work System → `journey`
- Work System has `outcome_records.status=not_measured` → one `outcome` gap (warn, never reject)
Do not invent measured KPIs. Do not edit frontend, Chart, Plan, NEXT.md.
Tests: three kinds created on a real import; outcome gap present while not_measured; RLS; GQS still the reject.
Branch `claude/v10-5b-gap-tiers`. PR → main. Stop.

---

## Cursor

If a PR titled V10-4 is still open: stop.

**V10-3 UI + outcome strip on Plan only.**
`CensusPlan.tsx`: columns in customer words — how sure we are, checked by, independent?
Read live `verification_design` + `certification` (V10-3). Predicted cannot display as sure.
One Outcome line: promised = sitting sentence, measured = **not measured** (GET `/work-systems/{id}/outcome`). Never print 62%.
Do not edit backend. Do not rebuild Chart 18-leaf.
Playwright: Plan shows not measured + 95 and 61.8; guest 1→6.
Branch `cursor/v10-3-plan-columns` off latest main. PR → main. Stop.
