# V10-11 contract — states + admissibility (backend only)

Claude implements **this file**. No extra product. No frontend.

Canon: a piece of work must have a **named before and after**, and a **real finish**. A piece with no observable exit, two owners, or an unaffordable check is **refused on this journey**. Gate 9 on import **stays a warning** for every other client. V10_CLOSE.md “V10-11 · STATES + ADMISSIBILITY”. Canon Parts 4–5.

---

## Already on `main` (reuse, do not replace)

| Already there | Role |
|---|---|
| `work_units.current_condition` / `desired_condition` | named before / after. Do not add a second state table. |
| `work_units.owner` | one human. Empty = not named. |
| `work_units.sla_hours` / `verification_method` / `evidence_required` | cost of the check |
| `GapKind.missing_terminal_state` (Gate 9) | warn on **import**. Keep warn. Do not flip import to reject. |
| `GapKind.split_recommended` (Gate 6) | warn when owner/BO looks split. Keep warn on import. |
| Offer Desk → Onboarding `work_systems` | **this journey** |
| `GET /spec/handoff/{code}` + 5th gate | already refuses without a record / method / VERDICT / dual-employment stop. **Extend here.** |

---

## 1. Named states (Offer + Employee)

`GET /api/objects/{name}/states` where `name` is `offer` or `employee` (case-insensitive). Keyed, 401 without key.

Read this tenant's `work_units` whose `business_object` matches (case-insensitive contains `offer` / `employee` — use the unit's own `business_object` string, do not invent entity rows).

Return:

```
{ object: "offer" | "employee", states: [ { name, kind: "before" | "after" | "both" } ], empty: bool }
```

- `name` = trimmed `current_condition` or `desired_condition` (skip blanks).
- `kind`: seen only as current → `before`; only as desired → `after`; both → `both`.
- Deduplicate by lowercased name. Empty tenant → `{ states: [], empty: true }` — honest.
- Contractor is **not** this PR.

Do not write ontology `entity_types`. Do not invent Palantir nodes.

---

## 2. Admissibility — this journey only

A unit on the Offer Desk → Onboarding work system is **inadmissible** if any of:

1. **No observable exit** — `desired_condition` is non-empty **and** no work unit of the same client + same `business_object` has that string as `current_condition`. (Same idea as Gate 9; now it **refuses handoff**, not import.)
2. **Two owners** — `owner` contains `,` or ` and ` (case-insensitive). One human only.
3. **Unaffordable check** — `evidence_required` is true **and** (`sla_hours` is null or ≤ 0). A check with no hours we will defend is unaffordable.

`GET /api/work-systems/{id}/admissibility` (keyed):

```
{ work_system_id, refusals: [ { work_unit_id, code, reason: "no_exit" | "two_owners" | "unaffordable_check", detail } ] }
```

Empty refusals = admissible. Guest 401. Wrong tenant 404.

**Handoff:** `GET /spec/handoff/{code}` for a unit on this journey must also 422 with the same `reason` if that unit is inadmissible. Dual-employment stop still unliftable. Gate 9 import path **unchanged** (still accepts + warn).

Scope of “this journey”: the work system's units (reuse however `work_system` already lists Offer Desk + Onboarding units). If the work system has no units yet, admissibility is `{ refusals: [] }` — not a fake fail.

---

## Tests (real Postgres)

1. Offer with `current_condition=unchecked`, `desired_condition=accepted` plus a sibling unit `current_condition=accepted` → no `no_exit`.
2. Desired `accepted` with no sibling current → `no_exit` on GET admissibility **and** handoff 422. Import of that genome still **200 + warn** (Gate 9 stays warn).
3. Owner `Rashmi and Asha` → `two_owners`. Owner `Rashmi KN` → not.
4. `evidence_required=true`, `sla_hours` null → `unaffordable_check`. Same with `sla_hours=2` → not.
5. Tenant B cannot read tenant A's admissibility (RLS).
6. `GET /api/objects/offer/states` lists before/after from real units; empty tenant honest.
7. Dual-employment stop still blocks handoff even when admissible otherwise.
8. Full suite green. No new table unless you must; if you add one, HONESTY + alembic check clean.

---

## Refuse

Frontend · Chart 18-leaf · Plan 95/61.8 · Gap UI · Sit close · Contractor graph · flipping Gate 9 import to reject · Palantir · login · V10-12 · Darwinbox/Zwayam · rewriting Rashmi rows

`docs/HONESTY.md` paragraph. Branch `claude/v10-11`. Ready PR → `main`. **Do not merge.** Stop.
