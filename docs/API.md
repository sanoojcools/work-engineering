# HTTP API

Base URL: `http://localhost:8000/api`. Interactive docs: `http://localhost:8000/docs`.

The Vite UI calls the same paths via `/api` proxy. Spec routes require header `X-Spec-Key` (env `SPEC_API_KEY`, default `dev-spec-key-change-me`).

List endpoints return `{ "total": n, "items": [...] }`.

## Health and seed

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status, version, db_ready }` |
| POST | `/seed` | Idempotent O2C census. 16 Work Units if `WU-OTC-01` is absent |

## Ontology (Layer 0)

| Method | Path |
|---|---|
| GET, POST | `/ontology/types` |
| GET, PATCH, DELETE | `/ontology/types/{id}` |
| GET, POST | `/ontology/entities` |
| GET, PATCH | `/ontology/entities/{id}` |
| GET, POST | `/ontology/edges` |
| GET, POST | `/regulatory/` |
| GET | `/regulatory/{id}` |

## Work Units and Work Graph

| Method | Path |
|---|---|
| GET, POST | `/work-units/` |
| GET, PATCH, DELETE | `/work-units/{id}` |
| POST | `/work-units/{id}/reconcile` |
| POST | `/work-units/{id}/authoritative` |
| GET, POST | `/work-units/{id}/variants` |
| POST | `/work-units/{id}/promote` | Body: `{ to_level, approved_by, reason }` |
| POST | `/work-units/{id}/demote` | Body: `{ to_level, reason }` |
| GET, POST | `/work-graph/edges` |
| DELETE | `/work-graph/edges/{id}` |

Create body includes the 18-attribute contract (code, name, business object type, conditions, context, trigger, inputs, authority, actor constraints, acceptance, evidence, verification method, SLA, failure semantics, optional regulatory id, provenance). Owner and `actor_type` are H4 fields, not substitutes for each other.

## VERDICT, economics

| Method | Path |
|---|---|
| GET | `/verdict/` |
| PUT, GET | `/verdict/{work_unit_id}` | Body: seven integers 1–5 |
| GET | `/economics/` |
| PUT, GET | `/economics/{work_unit_id}` |

PUT VERDICT returns `recommended_level`, `applied_gates`, `allocation`, `mean`, `uncapped_level`. PUT economics returns the row plus `computed` hours/FTE.

## Discovery

| Method | Path |
|---|---|
| GET, POST | `/discovery/traces` |
| GET, POST | `/discovery/intent` |
| GET, POST | `/discovery/candidates` |
| GET, POST | `/discovery/gaps` |
| POST | `/discovery/gaps/scan` | Declared vs discovered |
| POST | `/discovery/suggest` | LLM; empty `items` when provider is `none` |

## Verification

| Method | Path |
|---|---|
| GET, POST | `/verification/runs` | Failed runs may auto-demote |
| GET | `/verification/autonomy-changes` |

## Spec API (execution systems)

| Method | Path | Auth |
|---|---|---|
| GET | `/spec/work-units/{code}` | `X-Spec-Key` |
| POST | `/spec/check` | Body: `work_unit_code`, `check_type` (`authority` \| `evidence` \| `condition` \| `acceptance`), `approver`, `actor`, `evidence_ref`, `object_state`, `caller` |
| GET | `/spec/checks` | |
| POST, GET | `/spec/trajectories` | |

## Projections (C3)

| Method | Path |
|---|---|
| GET | `/projections/inventory` |
| GET | `/projections/work-graph` |
| GET | `/projections/verification` |
| GET | `/projections/allocation` |
| GET | `/projections/economics` |

## Errors

- `401` missing/invalid spec key
- `404` unknown id or code
- `409` duplicate Work Unit code or entity type name
- `422` domain rules (promotion without runs, incomplete authoritative promotion, self-edge)
