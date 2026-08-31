# Work Engineering

A specification layer between enterprise intent and execution. It makes work machine-readable, verifiable, and allocatable. It does **not** run the work — execution systems (humans, agents, RPA, BPO) consume a spec.

The primitive is the **Work Unit**: an independently accountable commitment to move one business object from a stated current condition to a stated desired condition.

This repository implements Work Engineering Version 8 as a FastAPI + Postgres backend and a React + Vite UI.

- Concept source of truth: [docs/Work-Engineering-V8.md](docs/Work-Engineering-V8.md)
- Product snapshot (what is true now): [docs/STATUS.md](docs/STATUS.md)
- How this codebase maps to V8: [ARCHITECTURE.md](ARCHITECTURE.md)
- HTTP API: [docs/API.md](docs/API.md)

## Key concepts

| Concept | Meaning |
|---|---|
| **Work Unit** | 18-attribute contract. Incomplete contracts are human-readable, not machine-enforceable. |
| **Two graphs** | Enterprise Graph (ontology instances and how they connect) vs Work Graph (dependencies between Work Units). |
| **VERDICT** | Seven 1–5 scores → autonomy L1–L6, then four hard gates cap the result (H2). |
| **Promotion / demotion** | Up the ladder is a human decision. Down is automatic (G4). |
| **Economics** | Cost to do, cost to verify, exceptions, ontology maintenance, then attribution (H5–H7). |
| **Spec API** | Execution systems present authority, evidence, and object state. Denied without the contract token (G6). |
| **Projections** | Inventory, Work Graph, verification contracts, allocation, and economics are views of the same records (C3). |

Autonomy levels: L1 human only → L6 fully deterministic automation (no LLM).

## Quick start — Docker

Requires Docker Compose and a copy of `.env.example` as `.env` at the repo root (already gitignored).

```bash
cp .env.example .env   # Windows: copy .env.example .env
docker compose up --build
```

- UI: http://localhost:5173
- API: http://localhost:8000
- OpenAPI: http://localhost:8000/docs
- Postgres: localhost:5433 (`wep` / `wep` / `wep`)

Load the 16-unit order-to-cash census (idempotent):

- In the UI: Overview → **Load order-to-cash census**
- Or: `POST http://localhost:8000/api/seed`

The frontend proxies `/api` to the backend. Tenant-scoped routes authenticate with a per-org `X-Spec-Key` (see **Set up the demo** below).

## Set up the demo

**In the app:** open http://localhost:5173 and click **Set up the demo** on the Overview page. It seeds both tenants, imports the sample genome, issues the API keys, and signs the browser in — nothing to copy, no terminal. Switching between Client A and Sample Genome Co afterwards is one click from the same panel.

Everything below is the same thing from the command line, if you prefer it:

```bash
curl -X POST http://localhost:8000/api/demo/bootstrap
```

That seeds Client A's HR census, imports the shipped sample genome, and returns:

| Field | Use |
|---|---|
| `api_key` | **Client A** — the HR census walkthrough. Paste it into the app's key banner (Scout Interview or Genome) once; the browser stores and reuses it. |
| `sample_genome_api_key` | **Sample Genome Co** — the tenant holding the imported sample genome (GQS 94.29, clears the gate). Use this key to open it under Genome. |
| `sample_genome_import` | The import result: version id, GQS, and the supplied `dual_scoring_kappa`. |

Keys are shown **once** — the database stores only their hash. Re-running is safe and idempotent: it will not re-issue an existing key and will not re-import the sample.

**Lost the key mid-demo?**

```bash
curl -X POST "http://localhost:8000/api/demo/bootstrap?new_keys=true"
```

That retires the current keys and issues fresh ones. (`POST /api/org/keys/rotate` can't help here — it needs the key you no longer have.) Paste the new key into the app's banner and carry on.

Two things worth knowing, because both were silent traps:

- The sample lives in its **own tenant** because it and the Client A HR seed both define `WU-OFF-03` and `WU-OFF-04`, and `work_units` is unique on `(client_id, code)`. They are two genomes for two employers, not one genome to reconcile.
- The sample file carries no `dual_scoring_kappa`, and GQS awards that a flat 10 points — so on its own the file scores **84.29 and is blocked**. Bootstrap supplies `0.85` explicitly and reports it. That value is a stated demo input, not a measurement: nothing in this system produces two independent scorings to compute kappa from (see `docs/HONESTY.md`).

`POST /api/demo/bootstrap` returns a credential over an unauthenticated request. It is gated by `DEMO_BOOTSTRAP_ENABLED` (default `true`) — set it to `false` anywhere that is not a throwaway local database.

### Enabling the model (optional)

Scout's **Story to Structure** and Discovery's candidate suggestion use Claude when a key is configured, and fall back to a deterministic splitter when it isn't. Both states are supported; the UI says which one ran.

Add to `.env` (gitignored — never commit a key):

```
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-opus-5
```

Restart the backend. Story to Structure then returns candidate work units with the grid's fields filled in, and **every quoted span is verified to be a literal substring of what was said** — anything the model paraphrased is discarded rather than shown. Fields the transcript doesn't cover come back as "not stated" rather than guessed.

The test suite always runs with the model off (`tests/conftest.py`), so `pytest` never makes billed network calls even with a key in your `.env`.

### Walking it through

1. **Overview** — Prepare Client A HR demo, then Work Units → Discovery → Projections → VERDICT. This is a specified, verifiable inventory.
2. **Scout Interview** — start an SME session and fill the Work Capture Grid live; watch Genome Strength climb. Tour the five elevations.
3. **Future Preview → Generate V8 Work Units** — the generated genome is scored by the same GQS gate as any import, and is *expected* to be blocked. Scout data is honestly labelled `declared` provenance, and GQS weights `observed` at 40%, so a Scout-only genome is structurally capped below the gate. The gate reporting that gap is the point, not a bug.
4. **Genome** — switch the key to `sample_genome_api_key` and open the imported sample (GQS 94.29): ratify it, drill L1 → L2 → L3 through the full 18-attribute contract, then read the Automation Index. Same page, same pipeline as step 3 — the difference is that this genome's provenance is document-backed.

## Quick start — local

You need **Python 3.11 or 3.12**, Node 20+, and Postgres 16. Python 3.14 cannot install the pinned wheels (`pydantic-core`, `psycopg2-binary`).

### Database

```bash
docker compose up db
```

Copy `.env.example` to `.env` at the repo root. `DATABASE_URL` already points at `localhost:5433` (not 5432 — a Postgres you already run locally usually owns that port).

### Backend

```bash
cd backend
py -3.11 -m venv .venv          # or python3.12 -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
# settings read .env from the process working directory — copy it here, or start from repo root with DATABASE_URL set
copy ..\.env .env               # Windows
# cp ../.env .env               # macOS/Linux

# Create the schema FIRST — see below. Then serve:
python -m alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The schema is Alembic-owned: the app no longer calls `create_all()`, so without
`alembic upgrade head` it starts against an empty database and fails every request.

Alembic connects with `SYSTEM_DATABASE_URL` (the `wep` superuser that owns the tables),
not `DATABASE_URL` (`wep_app`, the non-superuser the app serves under so that row-level
security binds it). Migrating as `wep_app` fails with `must be owner of table work_edges`,
so keep both URLs in your `.env`.

`docker compose up` runs the migration for you before starting the API.

Seed from `backend/`:

```bash
python -m app.seed
```

Tests. Most run on in-memory SQLite, but the RLS and tenant-isolation suites need the real
Postgres from `docker compose up db` — without it they skip rather than fail, so a green run
with ~67 skips means those never executed:

```bash
pytest
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite serves http://localhost:5173 and proxies `/api` to http://localhost:8000.

### Bulk ingest from Excel

There is no bulk HTTP endpoint. From the repo root, with the API on :8000:

```bash
python -m pip install openpyxl
python bulk_ingest.py --init-template
python bulk_ingest.py --file HR_Work_Units_Bulk.xlsx --api http://localhost:8000
```

`--init-template` writes a starter workbook (including WU-ONB-04). Point `--file` at your own sheet if you already have one. Column names match the time-motion mapping: Code, Title, Business Object, Owner / Authority, Owner Type, Current/Desired Condition, Acceptance, Evidence, Verification Method, Do/Verify time.

Do not use `python bulk_ingest.py` from a folder that does not contain the script. `--key` is unused: Work Unit create is not the Spec API.

## Repository layout

```
backend/app/     FastAPI app: models, schemas, services, routers
backend/tests/   pytest
frontend/src/     React UI
docs/             V8 spec + API notes
```

## What this is not

Not an agent runtime, orchestrator, or BPMN engine. Actor orchestration, runtime enforcement *inside* an executor, and trajectory scoring are specified as consumers of this spec. This app records Spec checks and trajectories when an executor calls in; it does not execute Work Units.

## Licence and status

Internal / product prototype aligned to V8 (August 2026). VERDICT gating autonomy is a **hypothesis** in the spec; the four H2 gates are implemented as specified. The uncapped score-to-level mapping is a documented design decision — see [ARCHITECTURE.md](ARCHITECTURE.md).
