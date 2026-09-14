# MANDATE-4 contract — shadow backend (backend only)

Claude implements **this file**. No frontend, no Chart, no Plan copy, no sit-close, no next-questions, no GQS, no Gate 11, no ATS Stage → current_condition mapping, no Slack, no Clerk.

In-app self-reported finish times for one piece of work. No Slack, no Workday, no Clerk.

---

## 1. Table

`shadow_logs` (RLS, same pattern as `work_systems`):

| Column | Type |
|---|---|
| `client_id` | FK `clients.id` |
| `work_unit_id` | FK `work_units.id` |
| `occurred_at` | `timestamptz`, not null |
| `duration_minutes` | `int`, nullable, 1–480 |
| `note` | short, optional |
| `created_at` | `timestamptz`, not null |

Unique `(client_id, work_unit_id, occurred_at)`.

## 2. API (keyed — `X-Spec-Key`, 401 without one)

```
GET  /api/work-units/{id}/shadow-logs
POST /api/work-units/{id}/shadow-logs
     body: { occurred_at, duration_minutes?, note? }
     6th row for that unit -> 422 (cap 5)
     duration_minutes out of 1-480 -> 422
GET  /api/work-units/{id}/shadow-summary
     { count, last_five, label: "self_reported", confidence: "low", duration_minutes_sum: number | null }
     If any of the five lacks duration -> duration_minutes_sum is null (do not guess, do not average dates into hours)
```

## 3. Hard invariants

- These rows are **NOT** Observed system logs.
- Never write into 95 / 61.8 / stated / defended (`services/simulator.py`'s `STATED_HOURS_MO` / `DEFENDED_HOURS_MO`).
- Summary JSON must not contain keys: `stated`, `defended`, `61.8`.
- After POSTs, existing hours/Plan economics endpoints (`GET /api/simulations/offer-day1`) still return 95 and 61.8 as today.
- Logging times on a dual-employment piece does not lift the stop (`services/handoff.py`'s `DUAL_EMPLOYMENT_STOP_CODES`).

## Tests (real Postgres)

RLS two tenants; cap 5; 401; empty GET `[]`; summary label `self_reported`; duration sum null if a row has no duration; hours 95/61.8 unchanged after POSTs; stop still unliftable. All in `backend/tests/test_shadow_logs.py`.

## Refuse

Frontend · Chart · Plan copy · sit-close · next-questions · GQS · Gate 11 · ATS Stage → current_condition · Slack · Clerk.

`docs/HONESTY.md` paragraph. Ready PR → `main`. **Do not merge.** Stop.
