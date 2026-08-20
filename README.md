# Work Engineering

A specification layer between enterprise intent and execution. It makes work machine-readable, verifiable, and allocatable. It does **not** run the work — execution systems (humans, agents, RPA, BPO) consume a spec.

The primitive is the **Work Unit**: an independently accountable commitment to move one business object from a stated current condition to a stated desired condition.

This repository implements Work Engineering Version 8 as a FastAPI + Postgres backend and a React + Vite UI.

- Concept source of truth: [docs/Work-Engineering-V8.md](docs/Work-Engineering-V8.md)
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
- Postgres: localhost:5432 (`wep` / `wep` / `wep`)

Load the 16-unit order-to-cash census (idempotent):

- In the UI: Overview → **Load order-to-cash census**
- Or: `POST http://localhost:8000/api/seed`

The frontend proxies `/api` to the backend. Spec API calls from the UI send header `X-Spec-Key` (default `dev-spec-key-change-me`).

## Quick start — local

You need **Python 3.11 or 3.12**, Node 20+, and Postgres 16. Python 3.14 cannot install the pinned wheels (`pydantic-core`, `psycopg2-binary`).

### Database

```bash
docker compose up db
```

Copy `.env.example` to `.env` at the repo root. `DATABASE_URL` already points at `localhost:5432`.

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
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Tables are created on startup (`create_all`). There is no Alembic migration set yet.

Seed from `backend/`:

```bash
python -m app.seed
```

Tests (SQLite in-memory; Postgres not required):

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
