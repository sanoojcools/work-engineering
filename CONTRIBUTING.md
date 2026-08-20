# Contributing

This is a V8-aligned prototype. Behaviour should stay consistent with [docs/Work-Engineering-V8.md](docs/Work-Engineering-V8.md) and [ARCHITECTURE.md](../ARCHITECTURE.md). The Work Unit remains the only primitive; do not add an execution engine in this repo without an explicit product decision.

## Setup

See the README. Use Python **3.11 or 3.12** (not 3.14) for the pinned backend dependencies.

## Checks before a change

From `backend/`:

```bash
pytest
```

From `frontend/`:

```bash
npx tsc --noEmit
npm run build
```

Keep VERDICT hard gates (H2) exact. If you change the uncapped mean-to-level bands, say so in ARCHITECTURE.md — that mapping is a design decision, not a V8 formula.

Promotion must remain a human action. Demotion may stay automatic.

## Schema

There are no Alembic migrations. Model changes require a fresh Postgres volume (`docker compose down -v`) or a manual `DROP`. Tests rebuild SQLite per case.

## Do not commit

`.env`, `backend/.venv/`, `frontend/node_modules/`, `frontend/dist/`. Do not commit secrets. Change `SPEC_API_KEY` before any shared deployment.
