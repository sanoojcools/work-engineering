# Work Engineering

A specification layer between enterprise intent and execution. It makes work machine-readable, verifiable, and allocatable. It does **not** run the work — execution systems (humans, agents, RPA, BPO) consume a spec.

**Tenancy: multi-tenant.** Each org is a `client_id`. Tenant-scoped routes use a hashed org key (`X-Spec-Key`). Postgres **RLS** (`tenant_isolation`) isolates rows.

The primitive is the **Work Unit**: an independently accountable commitment to move one business object from a stated current condition to a stated desired condition.

This repository is FastAPI + Postgres + React. Concept papers started as V8; the live wedge is an HR **Offer Desk census** (six steps, guest walk).

- What is true now: [docs/STATUS.md](docs/STATUS.md)
- Known gaps and non-claims: [docs/HONESTY.md](docs/HONESTY.md)
- Security boundaries (hashes, RLS, dual-employment tests, demo keys): [docs/SECURITY_BOUNDARIES.md](docs/SECURITY_BOUNDARIES.md)
- HTTP API: [docs/API.md](docs/API.md)
- How the code maps to the V8 paper: [ARCHITECTURE.md](ARCHITECTURE.md)
- V8 concept paper: [docs/Work-Engineering-V8.md](docs/Work-Engineering-V8.md)
- Old planning decks: [docs/history/](docs/history/README.md) — **not** current product

## Key concepts

| Concept | Meaning |
|---|---|
| **Work Unit** | 18-attribute contract. Incomplete contracts are human-readable, not machine-enforceable. |
| **Two graphs** | Enterprise Graph (ontology instances) vs Work Graph (dependencies between Work Units). |
| **VERDICT** | Scores → how far a helper may go; hard gates cap the result. |
| **Spec API** | Execution systems present authority, evidence, and object state. Denied without the contract. |
| **95 / 61.8** | Offer Desk sitting: **95 hours stated**, **61.8 hours we will defend**. Two numbers. Never blended with self-reported times. |

## Quick start — Docker

**Required:** Docker Compose, then copy env **before** `up`.

```bash
cp .env.example .env   # Windows: copy .env.example .env
```

`.env` **must** set `PII_ENCRYPTION_KEY` and `SYSTEM_DATABASE_URL`. There is no default encryption key — the API will not start without it. `docker compose` without `.env` fails cryptically.

```bash
docker compose up --build
```

- UI: http://localhost:5173
- API: http://localhost:8000
- OpenAPI: http://localhost:8000/docs
- Postgres: localhost:5433 (`wep` / `wep` / `wep`)

The frontend proxies `/api` to the backend. Tenant-scoped routes authenticate with `X-Spec-Key` (see **Set up the demo**).

## Walking the product (what to show a reviewer)

**Guest, no key (front door):** Home → **Start census** → steps 1–6 (Scope → Capture → Evidence → Gap → Chart → Plan). Plan shows **95** and **61.8** as two numbers and **What can go wrong**. Chart is 18 pieces. Nothing is saved. No `we-spec-key`.

Offer Desk is the worked example inside Capture: three seats → Playback → sit close (goal / authority / acceptance) → Document check → Hours → Spec deny.

**Signed in (Set up the demo):** same walk, writes are real. Guest must not need this.

## Set up the demo

On http://localhost:5173 use **Set up the demo** (disclosure on Home). It seeds tenants, imports the sample genome, issues keys, and signs the browser in.

Or: `curl -X POST http://localhost:8000/api/demo/bootstrap`

Keys are shown **once**. `POST /api/demo/bootstrap` is unauthenticated and gated by `DEMO_BOOTSTRAP_ENABLED` (default `true`) — set `false` anywhere that is not a throwaway local database.

Lost the key: `POST /api/demo/bootstrap?new_keys=true` (retires old keys).

Kappa on the sample import is a **stated demo input**, not a measurement. See `docs/HONESTY.md` and `docs/SECURITY_BOUNDARIES.md`.

### Enabling the model (optional)

Story to Structure uses Claude when configured; otherwise a deterministic splitter. Tests always force the model off.

```
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-haiku-4-5
```

Never commit a key. Quoted spans must be literal substrings of what was said.

## Quick start — local

Python **3.11 or 3.12**, Node 20+, Postgres 16. Python 3.14 cannot install the pinned wheels.

```bash
docker compose up db
cp .env.example .env
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Alembic uses `SYSTEM_DATABASE_URL` (superuser `wep`). The app uses `DATABASE_URL` (`wep_app`) so RLS binds. Migrating as `wep_app` fails.

### Tests

**CI** (`.github/workflows/ci.yml`) runs pytest against **real Postgres 16**. That is the isolation proof (`test_rls_http.py`). Dual-employment stop tests are listed in [docs/SECURITY_BOUNDARIES.md](docs/SECURITY_BOUNDARIES.md).

**Local `pytest` on SQLite:** RLS and tenant-isolation tests **skip** rather than fail. A green run with those skips does **not** prove isolation.

```bash
cd backend && pytest -q
```

### Frontend

```bash
cd frontend && npm install && npm run dev
```

Vite: http://localhost:5173 — proxies `/api` to :8000.

### Bulk ingest from Excel

There is no bulk HTTP endpoint. Local CLI only, API on :8000:

```bash
python -m pip install openpyxl
python scripts/bulk_ingest.py --init-template
python scripts/bulk_ingest.py --file HR_Work_Units_Bulk.xlsx --api http://localhost:8000
```

## Repository layout

```
backend/app/     FastAPI: models, schemas, services, routers
backend/tests/   pytest (RLS tests need Postgres)
frontend/src/     React UI
docs/             STATUS, HONESTY, API, contracts, SECURITY_BOUNDARIES
docs/history/     superseded planning — ignore for review
packs/hr/         Offer Desk question bank
scripts/          local CLI (bulk ingest) — not an HTTP API
```

## What this is not

Not an agent runtime, orchestrator, or BPMN engine. Not Workday. It records Spec checks; it does not execute Work Units.

## Licence and status

Internal / product prototype. VERDICT gating autonomy is a **hypothesis**; hard gates are implemented. See [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/HONESTY.md](docs/HONESTY.md).
