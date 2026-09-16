# Contributing

This is a **specification-layer** prototype (FastAPI + Postgres + React). Behaviour should stay consistent with the live census walk in [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md). Origin concept: [docs/Work-Engineering-V8.md](docs/Work-Engineering-V8.md) (idea paper, not a UI version stamp). The Work Unit remains the only primitive; do not add an execution engine in this repo without an explicit product decision.

## Setup

See the README. Use Python **3.11 or 3.12** (not 3.14) for the pinned backend dependencies.

## Checks before a change

From `backend/`:

```bash
pytest
```

CI runs pytest against **real Postgres 16**. Local SQLite skips RLS tests — a green skip run does not prove isolation.

From `frontend/`:

```bash
npx tsc --noEmit
npm run build
```

Keep VERDICT hard gates exact. If you change the uncapped mean-to-level bands, say so in ARCHITECTURE.md — that mapping is a design decision, not a formula from the origin paper.

Promotion must remain a human action. Demotion may stay automatic.

## Schema

Schema is **Alembic-owned** (`backend/alembic/versions/`). Change models with a new migration. `alembic check` must stay clean. Do not `create_all()` in the app. Migrations run as superuser `wep` (`SYSTEM_DATABASE_URL`); the app uses `wep_app` so RLS binds.

## Do not commit

`.env`, `backend/.venv/`, `frontend/node_modules/`, `frontend/dist/`. Do not commit secrets. Rotate org keys before any shared deployment.
