# NEXT — agents read this and execute their section

V10-3 verify/cert **shipped** (PR #25). Do not rebuild it.

---

## Claude

Execute **V10-5 BACKEND only** — Outcome Record.

- Table `outcome_records` (RLS): work_system_id, promised text, measured text nullable, status `not_measured` | `measured`
- GET/PUT `/api/work-systems/{id}/outcome`
- Default for offer→Day-1: promised = sitting outcome sentence from Offer Desk meta; measured = **null**, status = `not_measured`. **Never invent 62%.**
- Do not edit frontend, Chart, Plan, Evidence, hire_leaves.yaml, NEXT.md.
Tests: guest 401; keyed GET shows not_measured; PUT measured only with a real number+source else 422; RLS.
HONESTY.md. Branch `claude/v10-5-outcome`. PR → main. Stop.

---

## Cursor

Execute **V10-4 FRONTEND only**.

Read `packs/hr/hire_leaves.yaml`. Work Chart: **exactly 18 leaves**, bands automate/augment/human/**external**, composite “the hire is complete”.
Synthetic names on Chart (not Rashmi/Zwayam). Do not edit backend. Do not edit `CensusPlan.tsx`. Do not commit leftover V10-2 Evidence files onto main.
Playwright: Chart shows 18 leaves + an external band; guest 1→6; Plan still 95 and 61.8.
Branch `cursor/v10-4-chart` off latest **main**. PR → main. Stop.
