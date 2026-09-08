# V10-8 contract — field ratify + decision cards (backend only)

Claude implements **this file**. No extra product. No frontend.

Canon: sit close shows drafted **goal / authority / acceptance** beside the person's words; confirm or correct writes the field. One gap → one named human → one action. V10_CLOSE.md V10-8. Canon Part 3.

This is **not** Work System ratify and **not** `confirm-function-intent` / `confirm-work-system-intent`. Those already exist. Do not extend them.

---

## Reuse (do not replace)

| Already on `main` | Role |
|---|---|
| `work_units.desired_condition` | goal (post-state). Column is `String(80)` — clip on write, do not widen. |
| `work_units.authority` | authority |
| `work_units.acceptance_criteria` | acceptance |
| `work_units.owner` | named human on a card (verbatim; empty → `"not named"`) |
| `conformance_gaps` | decision cards **read** these. No new `GapKind`. |
| `field_pointers` | if a `declared` pointer exists for that unit+field, `sitting_quote` must be a substring of that pointer's quote |
| `AuditLog` | every confirm/correct |
| RLS / `client_id` | same tenant pattern as `work_systems` |

---

## New table `field_ratifications`

RLS-isolated. Unique `(client_id, work_unit_id, field_name)`.

| Column | Rule |
|---|---|
| `field_name` | closed enum: `desired_condition` \| `authority` \| `acceptance_criteria` |
| `sitting_quote` | required, min 8 chars, stored verbatim. Never invented by the API. |
| `drafted_value` | required, min 1 char |
| `confirmed_value` | null until confirm/correct |
| `status` | `drafted` \| `confirmed` \| `corrected` |
| `confirmed_by` / `confirmed_at` | null until confirm/correct |

Quote rule on create:

1. If a `declared` field pointer exists for this unit + field → `sitting_quote` must be a **literal substring** of that pointer's quote (422 otherwise).
2. Else store the quote as given. Do not call an LLM. Do not invent a pointer.

---

## HTTP (all keyed; no key → 401, never mint)

`GET /api/work-units/{id}/field-ratifications` — this tenant's drafts for that unit.

`POST /api/work-units/{id}/field-ratifications` body `{ field_name, sitting_quote, drafted_value }` — get-or-create. If a row already exists for that field, return it (do not overwrite a `confirmed`/`corrected` row; 409).

`POST /api/work-units/{id}/field-ratifications/{rid}/confirm` body `{ action: "confirm" \| "correct", confirmed_by, value? }`

- `confirm` copies `drafted_value` → `confirmed_value`, status `confirmed`.
- `correct` requires `value` and it must **differ** from `drafted_value` (422 if equal). status `corrected`.
- Then write `work_units.{field_name}` to `confirmed_value` (clip `desired_condition` to 80).
- 409 if already confirmed/corrected. Idempotent GET after that.

`GET /api/work-units/{id}/decision-cards`

- One card per **existing** `conformance_gaps` row on that unit. Empty list is honest.
- Shape: `{ gap_id, kind, description, named_human, action: "confirm_or_correct" }`.
- `named_human` = `work_units.owner` if non-empty, else `"not named"`. Do not invent Rashmi, Asha, or a CHRO.
- Do not guess a field_name onto the card. Cursor will pair cards to fields later.

Register on the existing work-units router (or a sibling under `/api/work-units`). Do not create `/api/census*` routes.

---

## Tests (real Postgres)

1. POST draft is idempotent per `(unit, field)`.
2. Confirm writes `work_units.authority` (and the other two fields in their own tests).
3. Correct writes a different value; equal-to-draft → 422.
4. No `X-Spec-Key` → 401. Guest path not invented.
5. Tenant B cannot read or confirm tenant A's row (RLS).
6. Confirm of authority **does not** lift the dual-employment stop (handoff for `WU-OD-02` still not ready if the stop language is missing).
7. Decision cards = real gaps only; a unit with zero gaps returns `[]`.
8. Declared pointer present + quote not a substring → 422.
9. Unique `(client_id, work_unit_id, field_name)`.
10. Alembic upgrade from empty + `alembic check` clean. Full suite still green.

---

## Refuse

Frontend · `CensusPlan.tsx` / Chart / Gap UI · new `GapKind` · INT-007 · login · V10-9 · LLM on this path · inventing measured KPIs · lifting dual-employment stop · GQS changes · Darwinbox/Zwayam · rewriting Offer Desk Rashmi rows

`docs/HONESTY.md` paragraph. PR `claude/v10-8` → `main`. **Do not merge.** Stop.
