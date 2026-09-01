# Work Engineering V8 + Scout — State and Reference

**Written:** 2026-09-01, by Claude Code, from a full re-scan of the repository at commit `95fc4f0` (33 commits, 2026-08-20 → 2026-09-01) — every router, service, model, migration, frontend page, and test file read directly, not recalled from memory. Companion document: `V8-PRODUCTION-ENGINEERING.md` (how this got built, and how to build the next one better). This document stands alone; it does not require the other repository docs open to make sense, though it points to them by exact path throughout so every claim here can be checked against its source.

---

## 1. What this product is

Work Engineering is a **specification layer**, not an execution system. Its argument, laid out in full in `docs/Work-Engineering-V8.md` (1,064 lines, structured as a hypothesis with explicitly marked evidence status per claim — Part I.5 catalogs "twenty-nine load-bearing claims, by evidence status"): organizations are trying to do five things at once — discover work, specify it precisely enough that a machine can check it, verify it independently, allocate it to the right actor (human, agent, deterministic automation, or an external vendor), and account for its true cost — and most representations of "work" (a BPMN diagram, a job description, a ticket) collapse several of these into one artifact, which is exactly what breaks once AI changes the *supply* of execution capacity without changing the other four demands.

The primitive is the **Work Unit**: an independently accountable commitment to move one business object from a stated current condition to a stated desired condition, described by an 18-attribute contract (identity, the state transition, applicability, authority, a verification contract, and operational fields — the exact list is in `docs/Work-Engineering-V8.md` Part E3 and enforced in `backend/app/services/contract.py`). Work Units connect to each other via a **Work Graph** (`sequence`, `shared_object`, `shared_resource`, `reciprocal` edges — distinct from the **Enterprise Graph**, which is the ontology of business objects, actors, and capabilities the Work Units act on; conflating the two graphs is named directly in the V8 doc, Part A2, as "the common error").

**Scout** is this repository's capture layer: structured interview sessions (founder-track and SME-track) that fill a live "Work Capture Grid," with five secondary "elevation" views over the same captured data (a deterministic day-schedule replay, a founder-vs-SME contradiction diff, a pain/automation-potential heatmap, an LLM-optional story-to-structure extractor, and a "Future Preview" that routes captured units through the same genome-import pipeline any other genome uses). Scout is not a separate product from Work Engineering V8 — it is the intake side of the same pipeline whose output side is Genome/GQS/VERDICT. One repository, one running app, two halves.

Two gates decide whether anything is trustworthy: **GQS** (Genome Quality Score — does this batch of Work Units meet a minimum evidentiary bar before any row is written) and **VERDICT** (does this specific Work Unit's contract support the autonomy level it's been given). Both are described precisely in §5 below, because both are frozen, single-source-of-truth code and worth quoting exactly rather than summarizing.

---

## 2. Current architecture

**Stack:** FastAPI 0.115 + SQLAlchemy 2.0 (`Mapped`/`mapped_column`) + Alembic 1.19 + Postgres 16, synchronous sessions throughout. React 19 + Vite 6 + TypeScript, no UI component library, no CSS framework, no client-side state management library — one hand-authored stylesheet (`frontend/src/index.css`, 738 lines) built on ~30 CSS custom properties (a warm paper/ink palette, three border weights, a three-tier elevation scale). Backend dependency footprint is deliberately small: `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, `pydantic`/`pydantic-settings`, `httpx`, `pytest`, `alembic`, `python-multipart`, `openpyxl`, `anthropic` — twelve pinned packages total, in `backend/requirements.txt`.

**Tenancy.** `clients.id` is the one and only tenant boundary (`backend/app/models/client.py`). Every tenant-owned table enforces this at the database level via Postgres Row-Level Security, not merely in application code — policies were added in migration `9a07306c5434` using `FORCE ROW LEVEL SECURITY` and a fail-closed predicate (`NULLIF(current_setting('app.current_client_id', true), '')::integer`), and a dedicated non-superuser role, `wep_app` (created in migration `f198c4aadd2c`), is what the application actually connects as — because a Postgres superuser bypasses RLS unconditionally, `FORCE` notwithstanding. Two tables are deliberately outside RLS: `clients` itself (it *is* the boundary) and `org_api_keys` (resolving which tenant a presented key belongs to has to happen before `app.current_client_id` can be set at all — it's protected instead by the key being a sha256 hash of a high-entropy secret, never RLS).

**Two database roles, two purposes, and this matters for anyone running migrations:**
- `wep_app` (`DATABASE_URL`) — the per-request runtime connection. Non-superuser, RLS-bound. Every ordinary request uses this.
- `wep` (`SYSTEM_DATABASE_URL`) — a superuser connection, used two ways: (a) by the small number of endpoints that are legitimately cross-tenant by nature (`SystemSessionLocal`/`get_system_db`/`SystemDbDep` — demo seeding, the consent-purge sweep), and (b) by Alembic itself, which must run as the schema-owning role, **not** `wep_app` — `wep_app` does not own the tables its own RLS policies are written against, so migrating as it fails with `must be owner of table work_edges`. See `V8-PRODUCTION-ENGINEERING.md` §4.4 for how this was found the hard way.

**Auth.** Per-org API keys (`X-Spec-Key` header → sha256-hashed lookup against `org_api_keys` → `require_org_api_key`/`OrgKeyDep`). Three dependency shapes matter, and mixing them up is the single most common source of bug in this codebase's history:
- **`TenantDbDep`** — requires a valid key, binds the session to that key's tenant via `SET app.current_client_id`, re-applied on every call (not `SET LOCAL`, deliberately — see the docstring on `tenant_db()` in `backend/app/dependencies.py`, which documents a real bug where `SET LOCAL` silently reverted at each transaction boundary inside a multi-commit request). Used by `work_units`, `spec`, `census`, `genome`, `files`, `org`, `consent`, `scout`.
- **`OptionalTenantDbDep`** — no key required, but *if* one is presented and recognized, binds the session the same way `TenantDbDep` does; a missing or unrecognized key leaves the session unbound (same behavior as before this existed). Used by `discovery`, `projections`, `verdict`, `work-graph`, `economics`, `verification` — routes deliberately left open (per `SCOUT_OPERATING_PLAYBOOK.md` §G.1, only `work_units`/`spec`/`census` were ever in scope for mandatory per-org auth) but which run as `wep_app`, meaning RLS still applies to them; without a tenant binding they simply answered from whatever a pooled connection happened to be carrying, which is a distinct, previously-live bug (see §6 below).
- **`DbDep`** — no auth, no tenant binding at all. `ontology`, `regulatory`, `clients` (list), `health`, `seed`. Correct where the resource genuinely isn't tenant-scoped (`ontology`/`regulatory` are global) or is cross-tenant by definition (`clients`).
- **`SystemDbDep`** — RLS-bypassing, superuser-backed. Never exposed on an ordinary request path; reserved for the handful of legitimately-cross-tenant maintenance operations.

**Two-tier test strategy.** Pure logic (GQS arithmetic, VERDICT gates, the classifier, the LLM verbatim-guardrail) runs on in-memory SQLite — fast, no external dependency. Anything whose correctness depends on database-enforced behavior — chiefly RLS, since `SET app.current_client_id` is Postgres syntax SQLite cannot execute at all — runs against a real Postgres on `localhost:5433`, and every such test file self-skips (`pg_skip`/`pytestmark`) if that database isn't reachable rather than failing loudly. **This means a green `pytest` run with Postgres unreachable is not the same claim as a green run with it reachable** — of the 140 total test functions, exactly 73 require real Postgres and skip without it (confirmed by running the suite both ways: 140 passed with Postgres up, 67 passed / 73 skipped with it down). See §7 for the exact breakdown.

---

## 3. Complete surface area

### 3.1 — Backend routers (`backend/app/routers/*.py`), all mounted under `/api`

| Router | Prefix | Auth | What it does |
|---|---|---|---|
| `admin.py` | (none) | mixed | `POST /seed` (order-to-cash census), `POST /demo/prepare`, `POST /demo/bootstrap` (one-call demo setup, mints first keys), `POST /admin/consent/purge` — all `SystemDbDep`, cross-tenant by nature |
| `census.py` | `/census` | `TenantDbDep` | one-click function census (draft VERDICT + inferred cost + gap scan); `client_id` mismatch is a 404, not 403/422 |
| `clients.py` | `/clients` | mixed | `GET /` (`SystemDbDep`, cross-tenant list for the switcher), `POST /` (`DbDep`, create tenant) |
| `consent.py` | `/consent` | `TenantDbDep` | DPDP consent receipts: create/list/get/revoke |
| `discovery.py` | `/discovery` | `OptionalTenantDbDep` | traces, intent, candidates (+accept/reject/merge), gaps (+scan), `POST /suggest` (LLM or deterministic split) |
| `economics.py` | `/economics` | `OptionalTenantDbDep` | cost profiles: list, upsert (marks `origin=confirmed`), get |
| `files.py` | `/files` | `TenantDbDep` | upload (server-sha256, 10MiB cap, csv/xlsx), classify (no-LLM header scorer), map-track-a (deterministic mapper → `import_genome`) |
| `genome.py` | `/genome` | `TenantDbDep` | import, versions list, gqs, detail, ratify (whole or scoped), L1/L2/L3 business-object drill-down, automation-index |
| `health.py` | `/health` | none | status/version/db_ready |
| `ontology.py` | `/ontology` | `DbDep` | entity types, entities, entity edges — global, not per-tenant |
| `org.py` | `/org` | `TenantDbDep` | `GET /whoami`, `POST /keys/rotate` (60-minute grace window) |
| `projections.py` | `/projections` | `OptionalTenantDbDep` | inventory, work-graph, verification, allocation, economics, pack (C3: five views of one record) |
| `regulatory.py` | `/regulatory` | `DbDep` | regulatory register entries — global |
| `scout.py` | `/scout` | `TenantDbDep` | interview sessions, captured units, all five elevations (timeline, contradictions, pain-heatmap, extract-from-story, future-preview/generate-genome) |
| `spec.py` | `/spec` | `TenantDbDep` | the Spec API execution systems consume: work-unit spec, enforcement check, checks list, trajectories |
| `verdict.py` | `/verdict` | `OptionalTenantDbDep` | list, upsert (derives autonomy), get |
| `verification.py` | `/verification` | `OptionalTenantDbDep` | runs (may trigger auto-demotion), autonomy-change history |
| `work_graph.py` | `/work-graph` | `OptionalTenantDbDep` | edges: list, create (rejects self-loop), delete |
| `work_units.py` | `/work-units` | `TenantDbDep` | CRUD, reconcile, authoritative, variants, promote, demote |

*(Full endpoint-by-endpoint detail, including request bodies and status codes, is in `docs/API.md` — kept current in nearly every commit; treat it as authoritative over any summary here.)*

### 3.2 — Backend services (`backend/app/services/*.py`)

The two frozen, single-source-of-truth modules — quoted in full because summarizing them risks the summary drifting from the code:

**`gqs.py`** (Genome Quality Score, gate threshold 90.0):

```
GQS = Observed% * 0.4 + Completeness% * 0.2 + ZeroOrphan * 10
    + ZeroViolations * 10 + Kappa * 10 + ProvenanceStructured% * 0.1
```

Runs against the *raw* uploaded payload, before Pydantic validation — deliberately, so a genome with schema violations still gets a score and an explanation rather than a bare 422. `_wu_is_complete()` requires all 18 attributes present, non-empty, and correctly shaped; a `dependencies: []` array is treated as a missing attribute, with no distinction for a work unit that legitimately has no in-genome predecessor (§6.4 covers the consequence of this). `_wu_is_observed()` checks `provenance.source_type == "observed"` — Scout-captured units are honestly `"declared"`, which structurally zeroes 40% of the score for any Scout-only genome (§5 covers this as the central, deliberate honesty finding of the whole demo narrative). `detect_schema_violations()` flags six categories: hardcoded `org` field, `total_work_units` drift from actual count, an out-of-contract `variant` field, unstructured (string) provenance, free-text regulatory links, and orphan dependencies (a `WU-` token that doesn't resolve within the same batch) — **not** cyclic dependencies (§6.3).

**`verdict.py`** (H1–H2, seven 1–5 properties → one autonomy level, deterministic, never LLM-judged): mean of `verifiability, evidence, reversibility, determinism, impact_scope, compliance, tacitness` maps to L1–L5 by band (`<2, <2.75, <3.5, <4.25, else L5`); L6 requires `determinism == 5 AND verifiability >= 4 AND tacitness >= 4 AND mean >= 4.5`. Four hard gates then cap the level regardless of mean: `compliance == 1` or a regulatory register entry requiring a licensed human → max L2; `reversibility == 1` → max L3; `impact_scope == 1` → max L3; no evidence path or `evidence == 1` → max L2. The mean-to-level banding is explicitly documented as this codebase's own design decision ("the extracted V8 text... does not publish an arithmetic for the uncapped mapping") — the four gates are V8-specified; the bands are not.

Everything else, condensed (full detail: the Explore-agent inventory folded into this document, or read the file directly — every one has a one-paragraph module docstring worth reading):

| Service | Responsibility |
|---|---|
| `genome_import.py` | Core import orchestration. Order is load-bearing: GQS scores the raw dict *before* Pydantic validation; pre-pass validators (file provenance, duplicate/existing codes) run before any write; the whole write phase is one rollback boundary. |
| `automation_index.py` | Hours current/saveable from *only* fields actually present (never imputed); idempotent `shared_object`/`shared_resource` edge detectors with named, sourced constants (`WORKING_DAYS_PER_MONTH=22`, bus-factor thresholds). |
| `census.py` | One-click function census: draft VERDICT + inferred cost + gap scan, skips already-`confirmed` VERDICT rows. |
| `classifier.py` / `track_a.py` | Deterministic (no LLM) header-matching and column-to-attribute mapping; anything under-confidence queues for human review rather than guessing. |
| `discovery.py` | D1–D3 discovery; LLM-assisted candidate suggestion with a deterministic line-splitter fallback. |
| `economics.py` | H5–H7: the four costing disciplines (do/verify/exceptions/maintenance) then attribution-confidence filter. |
| `promotion.py` | G4: promotion is a human decision (min runs, min pass rate, capped at VERDICT recommendation); demotion is automatic. |
| `pii.py` | Regex-only PII detection (email/phone/UAN-shaped) + pgcrypto field-level encryption. Explicitly out of scope for free-text personal names in prose. |
| `llm.py` | Single chokepoint for every model call (Anthropic SDK). `LLM_PROVIDER=none` is a fully supported state, not a degraded one; every caller has a deterministic fallback. |
| `scout_story.py` | The verbatim guarantee: every span an LLM returns is checked against the source transcript and discarded if not a literal substring. |
| `scout_genome.py` | Maps captured Scout units onto the 18-attribute contract via the *same* `import_genome` path — no parallel writer; unasked-for attributes get one honest literal placeholder, never fabricated content. |
| `tenants.py` | Catalog/Client A tenant-boundary logic; `FUNCTION_PREFIXES` — the code-prefix-to-function mapping the Work Graph page's node coloring reads client-side. |

### 3.3 — Data model

RLS applies either directly (a table with its own `client_id` column) or transitively (via a foreign key to a table that has one — e.g. `CostProfile` via `work_unit_id`). Not RLS-protected: `clients`, `org_api_keys`, `entity_types`/`entities`/`entity_edges` (global ontology), `regulatory_entries` (global register).

Core tables: `clients`, `entity_types`/`entities`/`entity_edges` (Enterprise Graph), `work_units` (the 18-attribute contract, unique on `(client_id, code)`), `work_edges` (Work Graph — RLS checks *both* `source_id` and `target_id` "for defense in depth"), `work_unit_variants`, `verdict_scores`, `cost_profiles`, `regulatory_entries`, `trace_events`/`intent_sources`/`discovery_candidates`/`conformance_gaps` (Discovery), `verification_runs`/`autonomy_changes`, `spec_checks`/`trajectories`, `org_api_keys`, `consent_receipts`, `audit_logs`, `uploaded_files`, `genome_versions` (carries **two distinct numbers** — `id`, the global primary key everything addresses by, and `sequence`, the tenant's own count starting at 1; conflating these was a real, fixed bug — §6.1), `review_queue`, `work_unit_provenance`/`work_unit_regulatory_links`/`pii_field_values`, `ratifications`, `scout_interview_sessions`/`scout_captured_units`/`scout_contradictions`.

### 3.4 — Alembic migrations, in order (single head, `alembic check` clean as of `95fc4f0`)

`b60fef9c9a01` (baseline) → `9a07306c5434` (pgcrypto + RLS) → `f198c4aadd2c` (`wep_app` role) → `d4d8503867c8` (`genome_version_id` FK) → `ee6982ff21fb` (Integer→Float fix for `gqs_score`/`confidence` — a real truncation bug: 94.29 was being stored as 94) → `69290a7410da` (`ratifications`) → `8ba56adb6720` (automation-index support) → `c1d2e3f4a5b6` (key rotation grace window) → `7079a0181dc8` (consent revoke/purge timestamps) → `b8469d3e03ae` (Scout sessions/units) → `2460d638860e` **(head)** (Scout contradictions + timeline).

### 3.5 — Frontend routes (`frontend/src/App.tsx`, all nested in `<AppShell/>`)

`/` Overview · `/ontology` · `/work-units` · `/work-graph` (custom SVG renderer, BFS-rank layout, function-coded nodes, typed/styled edges, hover-focus, zoom/pan) · `/verdict` · `/economics` · `/discovery` · `/verification` · `/spec` · `/projections` · `/scout/interview/:sessionId` (hosts all Scout sub-components) · `/scout` and `/scout/interview` (redirect to `/scout/interview/new`) · `/genome` (version index) · `/genome/:versionId` (GQS header, L1→L2→L3, ratify, Automation Index) · `*` (in-shell NotFound, so an unmatched URL keeps navigation rather than rendering blank).

---

## 4. What's real, what's specified-only, what's a stated hypothesis

This is a synthesis of `docs/HONESTY.md` (the canonical, continuously-updated source — read it directly for anything this section compresses) plus this scan's own findings.

**Fully live:** the 18-attribute contract's *enforced* subset (see `docs/HONESTY.md`'s per-attribute table for exactly which validators are enforced vs. merely specified — they differ, attribute by attribute); GQS as the import gate; VERDICT's four hard gates; per-org API keys with rotation and a grace window; Row-Level Security across every tenant-scoped table, HTTP-proven by `test_rls_http.py`'s two-tenant matrix; server-computed file-upload SHA-256; the deterministic (no-LLM) classifier, Track A mapper, and orphan-dependency review-queue path; partial (business-object- or unit-scoped) genome ratification with audit logging; the Automation Index's shared-object/shared-resource edge detectors; consent receipt creation, revocation, and a 90-day purge sweep (though it reports `0` purged in any real environment today — nothing yet writes a real receipt from an actual interview flow, `genome_import.py` still hardcodes `consent_receipt_id=None`); Scout's interview sessions, live Work Capture Grid, and completeness meter; all five Scout elevations, each with a real (if simple) deterministic mechanism — none of them, except Story-to-Structure, calls an LLM.

**Real, but conditionally so:** LLM-assisted extraction. With `LLM_PROVIDER=anthropic` and a key, `scout_story.py` calls Claude and returns genuinely extracted candidate work units — but every returned span is verified to be a literal substring of the source transcript and discarded otherwise, so "extraction" here means "the model's read of what was said, with any paraphrase or invention structurally impossible to smuggle through." Without a key (the default), the same endpoint runs a deterministic sentence-splitter and says so explicitly (`used_llm: false`). Both states are supported; neither is hidden as the other.

**Specified in the V8 document but not built here:** a live executor that actually *stops* on a denied Spec check (this repository logs the check and its result; enforcing the stop is explicitly out of scope — "governance by construction works only to the extent the runtime enforces it," V8 Part G6); object-centric ingestion connectors; LLM-as-judge over trajectories; per-user (as opposed to per-org) auth; six industry-specific demo companies. `docs/HONESTY.md` states the 15 "No-Cracks Gates" from the V8 spec are ~1 fully live (RLS), ~6 partially live, ~8 specified-only — **GQS ≥ 90 means the quality gate passed; it does not mean 15/15 gates passed.**

**Stated as a hypothesis, not a proven claim, by the source document itself:** the entire VERDICT-gates-autonomy mechanism. `docs/Work-Engineering-V8.md` Part G1 states this directly — "the claim, stated as a hypothesis because that is what it is" — and Part I catalogs the evidentiary basis honestly: one practitioner-reported favorable case, four unfavorable preprints (rule debt named as the one that actually bites), and an explicit list of what would prove the whole thesis wrong. This repository implements the mechanism faithfully; it does not — and the source document does not ask it to — claim the mechanism is validated.

---

## 5. Known structural findings and open gaps

These are the things a reader should know before trusting any number this system reports, in priority order. Findings 5.1–5.5 were fixed during this scan's own session; 5.6–5.7 remain open.

**5.1 — Fixed. `genome_versions` carries two numbers; only `sequence` should ever be shown to a person.** `id` is the global primary key every URL and route addresses by; `sequence` is the tenant's own count, starting at 1. The UI once displayed `id`, so a brand-new tenant's first-ever import could read "v27." Every route now returns both, and every human-facing label reads `sequence`.

**5.2 — Fixed. Analysis routes (`discovery`, `projections`, `verdict`, `work-graph`, `economics`, `verification`) were non-deterministic under connection pooling.** They run as `wep_app` (RLS-bound) but, being intentionally unauthenticated, had nothing setting `app.current_client_id` — so a request answered from whatever a previous request had left on that pooled connection, in practice usually nothing (`Projections` rendering `0 inventory` for a tenant holding real data), occasionally a *different tenant's* leftover binding. `OptionalTenantDbDep` (§2) fixes this: presenting a key now pins the request to that tenant; the routes remain open to a caller with none.

**5.3 — Fixed. Alembic could not be run as documented.** It connected using the RLS-bound application role, which does not own the schema its own RLS migration created — `alembic upgrade head` failed with `must be owner of table work_edges` against any database past that migration. Alembic now connects with the superuser (`SYSTEM_DATABASE_URL`).

**5.4 — Fixed. The flagship demo genome asserted a logical contradiction about its own process order.** Four pairs of work units in `samples/Private-Genome-MVP-HR-Ops-FIXED.json` each declared the other as a dependency — under this system's own definition of a `sequence` edge ("B cannot start until A completes"), that cannot honestly hold both ways. GQS's orphan-dependency check verifies a referenced id *exists*; it never checked whether the resulting graph is *acyclic*, so this shipped, undetected, for the project's entire history until a rendered chart looked wrong to a human. Fixed by removing the backwards half of each pair, each direction settled by the unit's own `current_condition`/`desired_condition`/`trigger` fields already in the file — never guessed.

**5.5 — A direct, reported consequence of 5.4: the sample genome's score moved from 94.29 to 92.86.** One unit (`WU-OFF-02B`) turned out to be a genuine chain root with no real in-genome predecessor, and lost its only (backwards) dependency, leaving `dependencies: []`. `gqs.py`'s completeness check (§3.2) treats an empty `dependencies[]` as a missing attribute unconditionally — it has no way to express "this unit legitimately has no dependency" versus "this unit is missing data." That ambiguity cost 1/14 of the completeness component. Still clears the 90-point gate (92.86); every place that hardcoded the old number (three tests, README, `docs/HONESTY.md`, `services/demo.py`'s comments) was updated. **This is a genuine, unresolved modeling gap, not fully fixed** — `gqs.py` is frozen and was correctly not touched to patch around it; a future version of the gate should decide deliberately whether "no dependency" needs an explicit marker distinct from "missing," the same way Scout's own completeness calculation already handles an unmeasurable dimension (`computed: false` rather than a faked `0%`).

**5.6 — Open. `ARCHITECTURE.md` and `docs/STATUS.md` are stale and actively misleading if read on their own.** `ARCHITECTURE.md` (written 2026-08-25, end of the Cursor-built prototype phase) states as current fact "No Alembic. Schema is create-on-boot" and "No app-user auth yet" — both have been false since 2026-08-27, and both are listed under "What is intentionally unfinished," which they no longer are. `docs/STATUS.md` (dated 25 August 2026 explicitly in its own header) describes a product with no Scout, no LLM integration, no multi-tenant keys, and states "no auth, schema is `create_all`" as the current ship-readiness bar — a snapshot of a system that stopped existing days after the file was written. **Do not treat either file as current.** The living, continuously-updated sources of truth are `docs/HONESTY.md`, `docs/API.md`, `README.md`, and this document. `V8-PRODUCTION-ENGINEERING.md` §4.7 covers why this happened and how to prevent it next time.

**5.7 — Open. A hardcoded default secret exists for PII field-level encryption.** `config.py`'s `pii_encryption_key` defaults to the literal string `"dev-pii-key-change-me"`, used directly by `services/pii.py` as the pgcrypto symmetric key, with no runtime check that it's been overridden and no mention in `.env.example` to prompt a developer to change it. This is the same shape of risk that was deliberately eliminated for the legacy global `spec_api_key` (Slice 3 PR 3a retired that default outright, with a test asserting the setting no longer exists) — the pattern recurred in an unaudited corner. Not fixed by this scan; flagged here so it isn't missed again.

---

## 6. Test coverage state

**140 test functions across 26 files** as of `95fc4f0`, all passing. Exactly **73 of those require a real, reachable Postgres on `localhost:5433`** and self-skip (not fail) if it isn't reachable — confirmed by running the suite both ways (140/0 with Postgres up, 67/73 pass/skip with it down) rather than estimated from the per-file table below — a green run with it unreachable is a materially weaker claim than a green run with it up; `README.md`'s own quick-start now says this explicitly, correcting an earlier version that didn't. `tests/conftest.py` forces `LLM_PROVIDER=none` for the entire suite via an autouse fixture, specifically so a developer's own `.env` key can never turn `pytest` into a live, billed network call.

Heaviest coverage, by file: `test_classifier_review_queue.py` (12), `test_api.py` (10), `test_verdict.py` / `test_parser_v2_minimum.py` / `test_org_key_migration.py` / `test_automation_index.py` (8 each). Postgres-only in full: `test_automation_index.py`, `test_business_objects_disclosure.py`, `test_consent_purge.py`, `test_file_upload_sha256.py`, `test_partial_ratify.py`, `test_projections_tenant_binding.py`, `test_rls_http.py`, `test_scout_elevations.py`, `test_scout_future_preview.py`, `test_scout_pain_story.py`, `test_scout_sessions.py`. Pure-unit, no database at all: `test_economics.py`, `test_gqs.py`, `test_no_pii_or_org_hardcode.py` (static source-scan for hardcoded org names/real PII), `test_top_level_extra_forbid_regression.py`, `test_scout_story_llm.py` (stubs the LLM call to test the verbatim guardrail specifically).

No CI runs any of this automatically, on any branch, at any point in this project's history — see `V8-PRODUCTION-ENGINEERING.md` §4.1.

---

## 7. Demo readiness

`POST /api/demo/bootstrap` (gated by `settings.demo_bootstrap_enabled`, must be `false` outside a throwaway local database — it mints a plaintext credential over an unauthenticated request) seeds Client A's 12-unit HR census, provisions a separate **Sample Genome Co** tenant (needed because the shipped sample genome and Client A's seed both define `WU-OFF-03`/`WU-OFF-04`, and `work_units` is unique on `(client_id, code)`), imports the sample genome into it with an explicitly-supplied `dual_scoring_kappa=0.85` (stated as a demo input, not a measurement — nothing in this system produces two independent scorings to compute kappa from), and mints both tenants' first API keys. Idempotent; `?new_keys=true` recovers from a lost key without touching the database by hand.

The frontend's `DemoSetup` component calls this on a single click, stores both tenants' keys, and signs the browser in — no terminal step, no copy-pasted secrets. `OrgKeyControl` in the sidebar shows which tenant the browser is currently authenticated as and offers a one-click switch. Verified this session, from a freshly-created and migrated database, with zero pre-seeded state: setup → sample rows to 100% completeness → live Claude extraction with verbatim verification → tenant switch → ratify → L1→L2→L3 drill → Automation Index, with zero console errors and zero HTTP errors throughout (Playwright-driven, not eyeballed).

---

## 8. Reference map

Paths from the repository root. Where a file's purpose is already covered precisely above, this table gives the path and a one-line pointer rather than repeating the content.

### Concept and status (read in this priority order — later entries are increasingly stale)

| File | Currency | Role |
|---|---|---|
| `docs/Work-Engineering-V8.md` | Source document, timeless | The concept itself — start here for *why*, not *how it's coded*. |
| `docs/HONESTY.md` | **Living — updated nearly every commit** | Real vs. specified, attribute by attribute. Trust this over any summary, including §4 above. |
| `docs/API.md` | **Living — updated nearly every commit** | The full HTTP surface, endpoint by endpoint, with auth notes. |
| `README.md` | Living | Setup, quick-start, demo walkthrough. |
| `ARCHITECTURE.md` | **Stale — see §5.6** | Written 2026-08-25; contradicts current reality on Alembic and auth. |
| `docs/STATUS.md` | **Stale — see §5.6** | Dated 2026-08-25; describes a pre-Scout, pre-multi-tenant product. |

### Scout-specific planning docs (all dated, all self-described as "corrected" once)

`SCOUT_OPERATING_PLAYBOOK.md` (binding execution contract, freeze list, slice tag sequence) · `Scout-Reference.md` (18 attrs as implemented, gate-by-gate) · `Scout-State.md` (what was actually tested) · `SCOUT_AMBITIOUS_PLAN.md` (why the slices are ordered as they are) · `Scout-Enhanced-Vision.md` (pitch, explicitly separated from verified claims) · `AMBITIOUS-HIGH-LEVERAGE-NEXT-ACTIONS-V0-7.md` (an earlier planning snapshot, dated 2026-08-26 — read for history, not current state).

### Frozen business logic

`backend/app/services/gqs.py` (quoted in full, §3.2) · `backend/app/services/verdict.py` (quoted in full, §3.2). Both explicitly named in nearly every feature commit's "must not touch" scope.

### Core code, by concern

| Concern | Path |
|---|---|
| Tenancy/RLS session plumbing | `backend/app/dependencies.py`, `backend/app/db.py` |
| Config surface (every env var, every default) | `backend/app/config.py`, `.env.example` |
| Import pipeline | `backend/app/services/genome_import.py`, `backend/app/routers/genome.py` |
| Scout capture | `backend/app/routers/scout.py`, `backend/app/services/scout*.py`, `frontend/src/pages/ScoutInterview.tsx`, `frontend/src/components/scout/` |
| Work Graph rendering | `frontend/src/pages/WorkGraph.tsx` (custom SVG, no charting library) |
| Demo bootstrap | `backend/app/services/demo.py`, `frontend/src/components/DemoSetup.tsx` |
| Design tokens | `frontend/src/index.css` (`:root` block, ~30 custom properties) |

### Samples

`samples/Private-Genome-MVP-HR-Ops.json` (original, real PII intact — do not use as a demo fixture) · `...-SCRUBBED.json` (PII-safe, deliberately still carries six real GQS violations — used to prove the gate blocks it, scores 40) · `...-FIXED.json` (the corrected, demo-facing sample — see §5.4–5.5 for its one remaining known issue and how it was resolved).

---

*This document and `V8-PRODUCTION-ENGINEERING.md` were written together, from the same scan, to be read together — this one for what's true now and where to verify it; that one for how the codebase got this way and how to build the next one with less friction.*
