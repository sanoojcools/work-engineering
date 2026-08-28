# HTTP API

Base URL: `http://localhost:8000/api`. Interactive docs: `http://localhost:8000/docs`.

The Vite UI calls the same paths via `/api` proxy. Genome, files, work-units,
spec, census, and org routes all require header `X-Spec-Key`: a per-org
credential looked up against `org_api_keys` (see `POST /org/keys/rotate`
below), not a single shared secret — there is no env-var default. Every
other router listed here (ontology, discovery, projections, verdict,
work-graph, economics, regulatory, verification, clients, admin) is
unauthenticated.

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

`/work-units/*` requires `X-Spec-Key` (per-org). `/work-graph/*` does not.

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

Create body includes the 18-attribute contract (code, name, business object type, conditions, context, trigger, inputs, authority, actor constraints, acceptance, evidence, verification method, SLA, failure semantics, optional regulatory id, provenance). Owner and `actor_type` are H4 fields, not substitutes for each other. `client_id` in the body is ignored if present — a create is always scoped to the calling key's own org.

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

## Census

Requires `X-Spec-Key` (per-org). `client_id` (body for `/run`, path for `/pack`) must equal the calling key's own org — a mismatch is a `404`, not a `422` or `403`, matching the rest of the tenant boundary.

| Method | Path |
|---|---|
| POST | `/census/run` | Body: `{ client_id, function, sop_text, executions_per_month? }` |
| GET | `/census/pack/{client_id}` | Query: `function` |

## Org keys

| Method | Path | Auth |
|---|---|---|
| POST | `/org/keys/rotate` | `X-Spec-Key` (the key being rotated) |

Returns the new plaintext key once: `{ client_id, key, key_id, old_key_id, old_key_expires_at }`. The old key keeps authenticating until `old_key_expires_at` (a 60-minute grace window), then `401`s.

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
