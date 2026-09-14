# Security boundaries (honest)

Staff-engineer notes. Not a SOC 2 pack.

## Tenancy

**Multi-tenant.** Each customer is a `client_id`. Browser/API auth for tenant-scoped writes is a hashed org key (`X-Spec-Key`). Postgres RLS policy `tenant_isolation` is the isolation mechanism.

The GitHub repository **About** blurb that says “single-tenant” is **wrong**. Isolation is tested in CI against real Postgres (`backend/tests/test_rls_http.py`). A local `pytest` on SQLite **skips** those tests — a green run with skips does **not** prove isolation.

Login (Clerk / WorkOS / SSO) is **not wired**. A `users` table may exist as schema-only scaffolding.

## Provenance hashes on genome import

`POST /api/genome/import` accepts `provenance.hash_sha256` from the **caller**.

It is **not** server-computed. It is **not** a cryptographic guarantee that a file existed or matched bytes. Treat it as a declared label.

This is a **known boundary**, not an accidental omission. We do **not** 422 observed imports that lack a server hash: that would break the demo pack before we have a file-writer that hashes on upload.

File **pointers** (CSV/XLSX cell, PDF page) are a different path: the backend opens the stored file. Do not confuse the two.

## Dual-employment stop

The stop is enforced on handoff / simulator paths (a helper pack cannot lift it with “ambitious”). It is not only a frontend banner. Logging self-reported times does not lift it.

## Demo bootstrap

`POST /api/demo/bootstrap` mints keys over an unauthenticated request. It is for throwaway demo DBs. Set `DEMO_BOOTSTRAP_ENABLED=false` anywhere that is not that.

## Encryption

`PII_ENCRYPTION_KEY` has no default. The app refuses to start without it. Copy `.env.example` before `docker compose up`.
