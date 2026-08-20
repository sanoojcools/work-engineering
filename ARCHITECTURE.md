# Architecture

Work Engineering sits **between** enterprise intent and execution. This codebase is the specification layer described in Version 8. Execution systems consume the spec; they are not built here.

Concept document: [docs/Work-Engineering-V8.md](docs/Work-Engineering-V8.md).

```
[ Enterprise Ecosystem Representation ]
        Ontology + Enterprise Graph          ← Layer 0 (container)
                    │
                    │ intent
                    ▼
        [ Work Engineering — this repo ]
          Discovery
          Definition (Work Units + Work Graph)
          Verification design + runs
          Allocation (VERDICT) + economics
          Spec API / Enforcement Gateway
                    │
                    │ specification (C4)
                    ▼
        [ Execution: human | agent | deterministic | external ]
                    │
                    ▼
                 Outcome
        loops: Discovery, Outcome, Policy (A3)
```

## How layers map to V8

| V8 | In this repo |
|---|---|
| **A1–A2** Container + two graphs | `ontology` types/entities/`entity_edges` vs `work_edges` on Work Units |
| **A4** Execution layers 1–3 | Not implemented as runtimes. Spec API + `trajectories` are the ingest points |
| **C2** Four activities | Discovery, Work Unit design, verification, VERDICT/economics routers |
| **C3** Five projections | `GET /api/projections/{inventory,work-graph,verification,allocation,economics}` |
| **C4 / G6** Spec consumed, governance by construction | `GET /api/spec/work-units/{code}`, `POST /api/spec/check` (`X-Spec-Key`) |
| **D1–D3** Traces, intent, candidates, conformance gap | `/api/discovery/*`, including `POST /gaps/scan` |
| **E3** 18-attribute contract | `WorkUnit` model + `services/contract.py` (`machine_readable`) |
| **E4** Draft / reconciled / authoritative | `POST .../reconcile`, `POST .../authoritative` |
| **E5** Variants | `work_unit_variants` |
| **E6** Regulatory register | `regulatory_entries`; licensed-human flag feeds Gate 1 |
| **E7** Provenance | `observed \| declared \| inferred \| designed` |
| **F3** Work Graph edge types | `sequence`, `shared_object`, `shared_resource`, `reciprocal` |
| **G3** Seven verification methods | Enum on the contract + `verification_runs` |
| **G4** Promotion human, demotion automatic | `POST .../promote` vs auto-demote on fail rate or a tighter VERDICT cap |
| **H1–H2** VERDICT + four hard gates | `services/verdict.py` |
| **H3** Make / agent / automate / buy | Derived per unit on the VERDICT row and allocation projection |
| **H4** Owner vs actor | `owner` (accountability) separate from `actor_type` (execution) |
| **H5–H7** Four costing disciplines | `services/economics.py` |

V8 J4 mentions a Neo4j Work Graph prototype. **This implementation stores both graphs in Postgres.** That is a deliberate stack choice, not a divergence from the conceptual model.

## VERDICT (H2)

Seven properties, each 1–5 (Annexure C: lower = harder to trust to automation):

Verifiability, Evidence, Reversibility, Determinism, Impact scope, Compliance, Tacitness.

**Uncapped mapping** (design decision — V8 does not publish the arithmetic):

- Mean of the seven scores → L1–L5 by bands (`<2`, `<2.75`, `<3.5`, `<4.25`, else L5)
- L6 only if determinism = 5, verifiability ≥ 4, tacitness ≥ 4, and mean ≥ 4.5

**Hard gates** (as specified):

1. Compliance = 1 **or** register requires a licensed human → max L2
2. Reversibility = 1 → max L3
3. Impact scope = 1 → max L3
4. No evidence path (empty `evidence_required` or Evidence = 1) → max L2

Scoring stores `recommended_level` and `applied_gates`. It does **not** promote. If the cap falls below the authorised `autonomy_level`, demotion is automatic.

Promotion: one level at a time, human `approved_by`, at least 5 runs, pass rate ≥ 95%, and not above the VERDICT recommendation. Demotion on fail rate ≥ 10% over recent runs (min 3).

## Economics (H5–H7)

Hours per month:

- Do = executions × minutes_to_do / 60
- Verify = executions × verification_minutes / 60
- Exceptions = executions × failure_rate × exception_minutes / 60
- Plus ontology/contract `maintenance_hours`
- Attributed = gross × `attribution_confidence`
- FTE = attributed / 160

Cost per verified unit uses do + verify + exceptions over verified completions (H7).

## Spec API (G6)

Execution systems send `X-Spec-Key`. Checks:

- **authority** — approver token must contain the contract `authority`; L1/L2 require an approver
- **evidence** — `evidence_ref` required when the contract names evidence
- **condition** — `object_state` must equal current (pre) condition
- **acceptance** — `object_state` must equal desired condition

Denied checks are stored. That is the audit trail; the executor must actually stop.

## Backend structure

```
backend/app/
  main.py           FastAPI app, CORS, create_all on startup
  config.py         pydantic-settings
  db.py             SQLAlchemy engine + Session
  models/           ORM (see data model below)
  schemas/          Pydantic request/response
  services/         VERDICT, economics, promotion, spec, contract, discovery
  routers/          HTTP, thin
  seed.py           Order-to-cash census (16 units)
backend/tests/     SQLite; 18 tests
```

Stack: FastAPI 0.115, SQLAlchemy 2, Postgres 16, sync sessions. Docker image is Python 3.12. Local installs need 3.11 or 3.12.

LLM-assisted `POST /api/discovery/suggest` returns `[]` when `LLM_PROVIDER=none` (import-only).

## Frontend structure

```
frontend/src/
  api.ts, hooks.ts, types.ts, ui.ts(x)
  layout/AppShell.tsx
  pages/            Overview, Ontology, WorkUnits, WorkGraph, Verdict,
                    Economics, Discovery, Verification, Spec, Projections
```

React 19 + Vite 6. Dev server proxies `/api` to the backend (`VITE_PROXY_TARGET` in Compose). No separate design system.

## Data model overview

Postgres tables (SQLAlchemy `create_all`):

| Table | Role |
|---|---|
| `entity_types`, `entities`, `entity_edges` | Ontology + Enterprise Graph |
| `work_units`, `work_unit_variants` | Contract + E5 variants |
| `work_edges` | Work Graph |
| `verdict_scores`, `cost_profiles` | Allocation and economics |
| `regulatory_entries` | E6 register |
| `trace_events`, `intent_sources`, `discovery_candidates`, `conformance_gaps` | Discovery |
| `verification_runs`, `autonomy_changes` | G3–G4 |
| `spec_checks`, `trajectories` | Spec consumption + Layer 3 ingest |

Work Unit attribute 15 (dependencies) is **not** a scalar; it is the Work Graph. Completeness still requires the other contract fields (`services/contract.py`).

## Key design decisions

1. **Specification, not execution.** Matches C4. No job runner.
2. **Postgres for both graphs.** Simpler operations than Neo4j for this prototype; edge types still match F3 / A2.
3. **Authorised vs recommended autonomy.** G4: humans promote; VERDICT and failure rates may only lower the authorised level.
4. **VERDICT mean bands are ours.** Gates are V8. Treat the uncapped function as replaceable.
5. **No app-user auth yet.** Spec routes use a shared secret. UI and inventory APIs are open on the local network — fine for a prototype, not for production.
6. **No Alembic.** Schema is create-on-boot. Destructive model changes need a fresh volume.
7. **Tests on SQLite.** Runtime is Postgres. Enums and JSON-as-text are kept portable.

## What is intentionally unfinished

Alembic, per-user auth, object-centric ingestion connectors, LLM-as-judge on trajectories, and a live executor that *stops* on a denied Spec check. Those belong under execution, or as later Work Engineering increments, not as a restart of V8.
