# Security boundaries (honest)

Staff-engineer notes. Not a SOC 2 pack.

## Tenancy

**Multi-tenant.** Each customer is a `client_id`. Browser/API auth for tenant-scoped writes is a hashed org key (`X-Spec-Key`). Postgres RLS policy `tenant_isolation` is the isolation mechanism.

Isolation is tested in CI against real Postgres (`backend/tests/test_rls_http.py`). A local `pytest` on SQLite **skips** those tests — a green run with skips does **not** prove isolation.

Login (Clerk / WorkOS / SSO) is **not wired**. A `users` table may exist as schema-only scaffolding.

## Provenance hashes on genome import

`POST /api/genome/import` accepts `provenance.hash_sha256` from the **caller**.

It is **not** server-computed. It is **not** a cryptographic guarantee that a file existed or matched bytes. Treat it as a declared label.

This is a **known boundary**, not an accidental omission. We do **not** 422 observed imports that lack a server hash: that would break the demo pack before we have a file-writer that hashes on upload.

File **pointers** (CSV/XLSX cell, PDF page) are a different path: the backend opens the stored file. Do not confuse the two.

## Dual-employment stop

Not a UI banner. Application logic, not a Postgres `CHECK`.

- Codes: `WU-OD-02` / `WU-OD-002` in `services/handoff.py::DUAL_EMPLOYMENT_STOP_CODES`.
- Handoff: `GET /api/spec/handoff/{code}` returns `dual_employment_stop_required: true` and `ready: false` when the stop language is missing. Ambition / moderation / field confirm / shadow times do not flip that.
- Simulator: `GET /api/simulations/offer-day1?scenario=ambitious` still reports `WU-HIRE-05` as `fires: blocked`, `blocked_reason: dual_employment`.

**Tests that fail if the stop lifts** (CI Postgres; they skip on SQLite):

| File | Test |
|---|---|
| `backend/tests/test_handoff.py` | `dual_employment_stop_required` is True and `ready` is False for WU-OD-02 without the stop language; moderation `to_level: 6` does not clear it |
| `backend/tests/test_v10_13_simulator.py` | `test_dual_employment_stop_unliftable_on_ambitious_with_real_twin` |
| `backend/tests/test_v10_14_handoff.py` | `test_dual_employment_unit_stays_unready_on_both_views` |
| `backend/tests/test_field_ratifications.py` | `test_confirm_of_authority_does_not_lift_dual_employment_stop` |
| `backend/tests/test_shadow_logs.py` | `test_dual_employment_stop_still_unliftable_after_shadow_logs` |
| `backend/tests/test_v10_11_states_admissibility.py` | `test_dual_employment_stop_still_blocks_handoff_when_otherwise_admissible` |

`backend/tests/test_v10_14_invariants.py` is the careful ≤ as_calculated ≤ ambitious lint. It is **not** the dual-employment proof. Do not cite it for this stop.

## Demo bootstrap

`POST /api/demo/bootstrap` mints keys over an unauthenticated request. It is for throwaway demo DBs. Set `DEMO_BOOTSTRAP_ENABLED=false` anywhere that is not that.

## Encryption

`PII_ENCRYPTION_KEY` has no default. The app refuses to start without it. Copy `.env.example` before `docker compose up`.
