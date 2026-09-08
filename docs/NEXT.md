# NEXT — agents read this and execute their section

Phase A walk (minus login) is on main. Do not rebuild Chart, Plan 95/61.8, or Gap buckets.
Factory model: **Sonnet** (`claude-sonnet-4-5`). Never Opus.

---

## Claude

**UNLOCKED — V10-8 BACKEND only.**

Read `docs/contracts/v10-8-field-ratify.md` and implement **exactly** that file.

- Table `field_ratifications` + RLS. Binding fields: `desired_condition` (goal), `authority`, `acceptance_criteria`.
- GET/POST drafts beside a sitting quote; POST confirm/correct writes the Work Unit column.
- GET decision-cards from **existing** `conformance_gaps` + `work_units.owner`. Empty is honest.
- Tests on real Postgres (list in the contract). `docs/HONESTY.md` paragraph.
- Branch `claude/v10-8`. One PR → `main`. **Do not merge. Do not start V10-9.**

If you are a cloud run and this section still said LOCKED, that was the previous commit — this commit unlocks you. Proceed.

---

## Cursor

**LOCKED.** Wait for V10-8 API on `main`. If you are a cloud run from this push: stop. No feature PR. Do not edit Chart/Plan/Gap.
