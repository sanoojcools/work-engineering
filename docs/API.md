# HTTP API

Base URL: `http://localhost:8000/api`. Interactive docs: `http://localhost:8000/docs`.

The Vite UI calls the same paths via `/api` proxy. Genome, files, work-units,
spec, census, org, and consent routes all require header `X-Spec-Key`: a
per-org credential looked up against `org_api_keys` (see `POST
/org/keys/rotate` below), not a single shared secret — there is no env-var
default. Every other router listed here (ontology, discovery, projections,
verdict, work-graph, economics, regulatory, verification, clients, admin)
is unauthenticated.

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

## Consent receipts (DPDP)

Requires `X-Spec-Key` (per-org). `consent_receipts` carries RLS same as `work_units` — a receipt id from another org is a `404`, not a `403`.

| Method | Path | Notes |
|---|---|---|
| POST | `/consent/receipts` | Body: `{ subject_id, purpose, data_principal_initials?, consent_text?, retention_days? }` (default 90). Returns the receipt, `expires_at = consented_at + retention_days`. Audits `org.consent.receipt.create`. |
| GET | `/consent/receipts` | List own org's receipts. |
| GET | `/consent/receipts/{id}` | `404` if the receipt belongs to another org. |
| POST | `/consent/receipts/{id}/revoke` | Body: `{ withdrawal_method? }`. Sets `status=withdrawn`, `revoked_at=now()`. Audits `org.consent.receipt.revoke`. |
| POST | `/admin/consent/purge` | Unauthenticated maintenance trigger (same trust level as `/seed`, `/demo/prepare`) for the daily auto-purge sweep. Tombstones every `status=active` receipt past `expires_at` (`status=purged`, `purged_at=now()`) across every tenant — cross-tenant by nature, so it runs on the RLS-bypassing system session, not a per-org key. Returns `{ purged: <count> }`. `withdrawn` receipts are left alone: the timer isn't a second purge path for a consent already withdrawn. Reports `0` until a receipt actually ages past its `expires_at` — that's expected, it proves the path runs end to end. |

## Scout Elevated V2 — interview sessions (PR1: Core)

Requires `X-Spec-Key` (per-org). `scout_interview_sessions` and `scout_captured_units` carry RLS same as `work_units` — a session or unit id from another org is a `404`. `scout_captured_units` is scoped via its parent session's `client_id`, not its own `client_id` column (kept only for query convenience).

| Method | Path | Notes |
|---|---|---|
| POST | `/scout/sessions` | Body: `{ type: "founder"\|"sme", interviewee_name, consent_receipt_id? }`. Returns the session with 8 completeness dimensions (all zero, no units yet). Audits `scout.session.create`. |
| GET | `/scout/sessions` | List own org's sessions. |
| GET | `/scout/sessions/{id}` | `404` if the session belongs to another org. |
| POST | `/scout/sessions/{id}/units` | Body: `{ name, inputs?, outputs?, systems?, frequency?, time_minutes?, pain?, handoffs?, decision_rule? }`. Appends a Work Capture Grid row, recomputes and stores `completeness_pct`. Audits `scout.unit.create`. |
| PATCH | `/scout/sessions/{id}/units/{unit_id}` | Partial update (any subset of the above fields) for inline-edit. `404` if the unit doesn't belong to `{id}`. Recomputes completeness. Audits `scout.unit.update`. |
| POST | `/scout/sessions/{id}/complete` | Sets `status=completed`. Audits `scout.session.complete`. |

**Completeness is not what the design doc originally specified.** The doc's formula was "captured / expected, expected from JD + logs baseline" — no JD or log ingestion exists, so `services/scout.py` uses a published constant (`EXPECTED_UNITS_PER_SESSION = 8`, same spirit as `BUS_FACTOR_WU_THRESHOLD` elsewhere) for the "Work Units Captured" dimension, and per-unit field-fill percentage for six more. The 8th dimension, **Knowledge Artifacts** (policies/JD/papers linked), has no real field to measure yet — it's returned with `computed: false` rather than a fake `0%`, and `completeness_pct` averages only the 7 dimensions that are actually computed (same `reciprocal_computed: false` honesty pattern as automation-index's cycle detection).

**No LLM calls anywhere in `routers/scout.py`.** `LLM_PROVIDER=none` in this environment — see the elevation-by-elevation breakdown below for what each one does instead.

### Elevation 1 — Time-Travel Replay

| Method | Path | Notes |
|---|---|---|
| GET | `/scout/sessions/{id}/timeline` | Returns the session's timeline, computing and caching it on first call. Deterministic placement (`services/scout_timeline.py`): units sorted by daily-minutes descending, packed into a published 09:00–18:00 window; `frequency` text converts to a daily minutes figure (`day`→as-is, `week`→÷5, `month`→÷22, matching automation-index's existing `WORKING_DAYS_PER_MONTH`). Flags `over_allocated` when total exceeds the window; reports gaps ≥30 min. |
| POST | `/scout/sessions/{id}/timeline/rebuild` | Re-runs the deterministic placement, discarding any manual edit. |
| PATCH | `/scout/sessions/{id}/timeline` | Saves a manually-corrected timeline verbatim (drag corrections) — the stored JSON is open-ended, not limited to the auto-builder's own shape. Audits `scout.timeline.update`. |

### Elevation 2 — Contradiction Resolver

RLS on `scout_contradictions` same as the direct-`client_id` tables.

| Method | Path | Notes |
|---|---|---|
| GET | `/scout/contradictions?session_id=` | Re-scans on every call (`services/scout_contradictions.py`): matches a founder-type session's unit against an sme-type session's unit by exact (case-insensitive) name, flags a contradiction when `systems`, `frequency`, or `inputs` differ and both sides answered. Plain text diff — no LLM, no measured confidence (the `confidence` field is fixed at 1.0, documented in the model as "not a measured statistic"). Optional `session_id` filters to contradictions touching that session. |
| POST | `/scout/contradictions/{id}/resolve` | Body `{ resolution }`. Sets `status=resolved`; a resolved pair is never re-flagged by a later scan. Audits `scout.contradiction.resolve`. |

### Elevation 3 — Pain & Automation X-Ray

| Method | Path | Notes |
|---|---|---|
| GET | `/scout/sessions/{id}/pain-heatmap` | Scoped to one session's units, not org-wide as the design doc's `?org_id=` suggested (a founder session naming no systems would otherwise dilute a real SME pain signal). `pain_score` (`services/scout_pain.py`) is a fixed keyword-weight lookup over the free-text `pain` field (`PAIN_KEYWORDS`, capped at 5) — explicitly **not** sentiment analysis. `automation_potential_pct` is each system's share of total daily minutes captured, not a modeled estimate. |

### Elevation 4 — Story to Structure

| Method | Path | Notes |
|---|---|---|
| POST | `/scout/extract-from-story` | Body `{ transcript_chunk }`. Checks `settings.llm_provider` first (real extraction would run here if configured); with none configured it falls through to a deterministic sentence-splitter (`services/scout_story.py`, same philosophy as `services/discovery.py`'s existing `split_text` fallback). Every returned chunk is a literal substring of the input by construction — Track B's own guardrail ("every generated span must be a substring of raw_text", `SCOUT_AMBITIOUS_PLAN.md` §4) is satisfied structurally, not checked after the fact. `used_llm` is always `false` in this environment. Doesn't write to the database. |

### Elevation 5 — Future Preview

| Method | Path | Notes |
|---|---|---|
| GET | `/scout/sessions/{id}/future-preview` | `unlocked` is `completeness_pct >= 100`. `time_saved_min_per_day` reuses the pain-heatmap total (no separate estimate). No confetti — see `HONESTY.md`. |
| POST | `/scout/sessions/{id}/generate-genome` | Calls the **existing** `services/genome_import.import_genome` — no parallel write path. Maps each captured unit to the 18-attribute contract (`services/scout_genome.py`); several attributes the Work Capture Grid never asks for (`trigger`, `actor_constraints`, `acceptance_criteria`, `evidence_required`, `failure_semantics`) get one honest literal placeholder string rather than fabricated content. `provenance.source_type` is `"declared"` (self-reported in a structured interview), not `"observed"`. Goes through the **same GQS gate** as any other import — a thin session's genome is expected to score low and get blocked, not pass on a relaxed rule; verified in `tests/test_scout_future_preview.py` (a 1-unit session scores GQS 30, `accepted: false`).

### Frontend — stitching Scout to V8 delivery

`frontend/src/pages/Genome.tsx` (route `/genome/:versionId`) is a UI over the existing `genome.py` router below — no new backend endpoints. It renders the GQS header (score, gates passed, ratify-whole-version), a Business Objects tab (L1 card list → L2 work-unit table → L3 full 18-attribute detail, plus ratify-one-business-object), and an Automation Index tab (L1–L6 autonomy counts, hours current/saveable, cost-per-unit banner, bottleneck view, work-graph edge counts). `FuturePreview.tsx`'s post-generate result links to `/genome/{version_id}` regardless of whether the gate passed, so the "what did Scout actually produce" question is always one click away. See `HONESTY.md` for the browser-verified GQS structural-cap finding for Scout-sourced genomes (declared, not observed, provenance) and the resulting empty-state behavior for a gate-failed version's Business Objects / Automation Index.

## Demo bootstrap

| Method | Path | Notes |
|---|---|---|
| POST | `/demo/prepare` | Seeds Catalog's 12 HR units, clones them to Client A, runs the inferred HR census. Cross-tenant, so it runs on the system session (`SystemDbDep`) — on the RLS-bound per-request session every `work_units` INSERT is rejected outright. |
| POST | `/demo/bootstrap` | `prepare` **plus** first API keys for Client A and a separate **Sample Genome Co** tenant (each plaintext returned once) **plus** the sample genome import. Idempotent. `?new_keys=true` retires the current keys and issues fresh ones — the recovery path for a lost key, since `/org/keys/rotate` requires the key you no longer have. This is the one-command local demo setup; before it existed, obtaining a first key meant a hand-written `org_api_keys` INSERT, because `/org/keys/rotate` can only rotate a key you already hold. Returns a credential over an unauthenticated request, so it is gated by `DEMO_BOOTSTRAP_ENABLED` and must be `false` outside a throwaway local database. Sample Genome Co exists because the shipped sample genome and the Client A HR seed share work unit ids. |

## Org keys

| Method | Path | Notes |
|---|---|---|
| GET | `/org/whoami` | Which tenant the presented `X-Spec-Key` belongs to. The UI had no way to know this, so the company switcher could sit on a company the key couldn't read and every tenant-scoped page rendered empty. |
| POST | `/org/keys/rotate` | Rotates; the old key keeps authenticating for `ROTATION_GRACE_MINUTES`. |

## Genome (Layer 1/2/3, ratify, automation index)

| Method | Path | Notes |
|---|---|---|
| GET | `/genome/versions` | Every genome version for the calling tenant, newest first. Declared above `/{version_id}` so the literal path wins the match. Without it, an imported genome was unreachable from the UI — every other route needs a `version_id` the caller had to have kept. |
| POST | `/genome/import` | See `HONESTY.md`'s per-attribute enforcement matrix. Work unit ids are validated against the tenant's existing ids in a pre-pass (`work_unit_id_already_exists`) and against each other (`duplicate_work_unit_id`) before anything is written; the write phase is one rollback boundary, so a rejected import writes none of its rows. |
| GET | `/genome/{version_id}/gqs` | Score, breakdown, gates passed/failed, `ratified`. |
| GET | `/genome/{version_id}` | Full version detail. |
| POST | `/genome/{version_id}/ratify` | Body `{business_object?, work_unit_ids?, approved, comment}`; requires `gates_passed == ["gqs", "pydantic_validation"]`. |
| GET | `/genome/{version_id}/business-objects` | L1. Empty for a gate-failed version — `import_genome` only persists `WorkUnit` rows on gate pass. |
| GET | `/genome/{version_id}/business-objects/{bo_name}/work-units` | L2. |
| GET | `/genome/{version_id}/work-units/{wu_code}` | L3, full 18 attributes. |
| GET | `/genome/{version_id}/automation-index` | Metrics, bottleneck view, work-graph edge summary. |

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
