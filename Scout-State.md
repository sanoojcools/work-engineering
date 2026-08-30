# Scout State - Current as of 2026-08-26 (corrected)
Date: 2026-08-26 | Branch: feat/genome-import-foundation | Tests: 28/28 (24 original + 4 GQS) | GQS: 40 blocked vs 94.29 pass | Postgres: Running via docker-compose | Nothing committed yet

**Correction note (this revision):** the prior version of this file attributed several guarantees to Pydantic validators, FK constraints, and a file-fingerprinting pipeline that were never built. Corrected below against the actual source in `feat/genome-import-foundation`, not against the prior doc's own claims.

## Source-of-Truth Hierarchy
1. V8 FULL
2. `services/verdict.py` — 4 gates: compliance=1 cap L2, reversibility=1 cap L3, impact=1 cap L3, no evidence path cap L2
3. Master Plan v0.4 + Critical Eval + AMBITIOUS v0.6 + CONTINUE v0.6.1
4. 5 HR Excels — sample only

Rules: no org hardcoding, no real PII (Person A, fake emails, UAN `XXXX-XXXX-XXXX-XXXX`), no invented thresholds (1/3/5 only published, 2/4 interpolation), no extra fields on a Work Unit (`variant` → `context.variants[]`), provenance structured, versioning v1/v2/v3 + semantic diff (diff engine not built yet — see below).

## What's Real and Verified (Actually Tested, Not Just Written)

**Alembic**: initialized, **4 migrations** applied cleanly against real Postgres, zero drift (`alembic check` confirms). Migrations: (1) baseline schema + P0 foundation tables, (2) pgcrypto extension + RLS policies, (3) `wep_app` non-superuser role, (4) `work_units.genome_version_id` FK.

**RLS tenant isolation** — 2 genuine bugs caught, not write-and-hope:
- Bug 1: `wep` is the Postgres bootstrap superuser, which bypasses RLS unconditionally regardless of `FORCE ROW LEVEL SECURITY`. First test showed org B reading org A's data — a real failure. Fixed by creating a non-superuser `wep_app` role the app now runs as.
- Bug 2: that same fix broke `bootstrap_tenants` (cross-tenant catalog-cloning startup step) — RLS silently returned 0 rows instead of erroring. Fixed with a separate `SystemSessionLocal` for maintenance-only operations, kept out of the per-request path.

Verified with real INSERT/SELECT against the restricted role inside actual transactions: org B sees 0 of org A's rows, org A sees exactly its own, an unset session variable sees 0 (fail-closed). Also proven via real HTTP this session:
```
POST /api/genome/import (scrubbed, 6 violations) -> 400, GQS=40, 62 violations listed
POST /api/genome/import (fixed)                  -> 201, GQS=94.29, 14 work units, 13 auto-derived Sequence edges
GET  /api/genome/{id} as Org A -> 200, 14 work units
GET  /api/genome/{id} as Org B -> 404 (RLS: genuinely invisible, not a leak)
POST /api/genome/{id}/ratify as Org A -> 200, ratified
No X-Spec-Key / wrong key -> 401
```
**Manual proof only** — this exists as a one-off script that was run and then cleaned up. There is no automated pytest for HTTP-level RLS yet.

**GQS calculator** (`app/services/gqs.py`): `samples/Private-Genome-MVP-HR-Ops-SCRUBBED.json` (PII scrubbed, 6 real violations preserved: org hardcoded, `total_work_units` drift, `variant` extra field, orphan-style references, provenance as free-text string, RR link as free text) scores **GQS=40** — a real number derived from **62 actually-detected violations** (the sample only contains 14 of ~62 planned Work Units, so many dependency references point outside the slice — that's why the count is higher than the single `WU-REC-01` example in the planning docs, not a bug). `samples/...-FIXED.json` (same data, violations corrected) scores **GQS=94.29**, passes. Both numbers come from running the code — 4 automated tests lock this in. 28/28 tests pass overall.

**VERDICT spec conflict caught and resolved**: `services/verdict.py` already correctly implements V8's real L1–L6 autonomy ladder and 4 hard gates. `CLAUDE-CODE-BUILD-READY-V0-5.md`'s version had wrong caps (L1/L2 instead of L2/L3) and an invented 5th gate not in V8. Left `verdict.py` untouched.

**Import pipeline, corrected description of what it actually does:**
- `schemas/genome_import.py` — `WorkUnitImport` (one Work Unit) has `extra="forbid"`. **`GenomeImportRequest` (the top-level container) has `extra="ignore"`, not forbid** — it deliberately accepts benign top-level metadata (`source_files`, `automation_index`, even a stray `org` field) without rejecting the whole payload. A hardcoded `org` field is not blocked by Pydantic; it's caught and scored down by the GQS violation detector instead.
- Field-level validation that **exists**: `provenance.source_type` must match `^(observed|declared|inferred|designed)$`; every Work Unit array field (`input`, `acceptance_criteria`, `evidence_required`) must be non-empty.
- Field-level validation that **does NOT exist** (despite being described elsewhere as implemented): no regex pattern on `id` (e.g. `^WU-[A-Z]+-[0-9]+$`), no `hash_sha256` format pattern, no "RR-" prefix pattern on `regulatory_register_link` entries, no verb-content check on `trigger`, no `model_validator` that rejects an orphaned dependency at the schema level.
- **The orphan-dependency guarantee is real, but it comes from GQS arithmetic, not a schema check**: any `orphan_dependency` violation zeroes both the Zero-Orphan (10 pts) and Zero-Violations (10 pts) components, capping the maximum possible score at 80/100 — always below the 90 gate. At the DB-write step, an unresolved dependency reference is simply skipped (no edge created), not rejected.
- `services/genome_import.py` orchestrates: GQS gate → Pydantic validation → `WorkUnit` row + `WorkUnitProvenanceDetail` + `WorkUnitRegulatoryLink` + `VerdictScore` (if a `verdict` block was supplied) + PII scan → `WorkEdge` (type=Sequence) created from each `dependencies` entry that resolves to a real unit in the same import → `GenomeVersion` row → `AuditLog` entries for `genome.import.attempt` and `genome.import.committed` only (ratify and reads are **not** currently audit-logged).
- `services/pii.py` — regex classification (email/phone/UAN-shaped) + pgcrypto encrypt/decrypt + redaction (first 3 chars + `***`). Proven live: real email/UAN text → encrypted → decrypted back correctly.
- **Regulatory links use the pre-existing `regulatory_entries` table** (columns: `id, regulation, clause, control_objective, requires_licensed_human`), not a new `regulatory_register` table. `regulatory_register_link` strings are matched against `regulatory_entries.regulation`; if no match exists, a stub row is **auto-created** with that string as `regulation` — this is a permissive upsert, not a strict "must already exist" FK check.
- **Work Graph edges reuse the pre-existing `work_edges` table** (with `EdgeType.sequence/shared_object/shared_resource/reciprocal`), not a new `work_graph_edges` table. Only the Sequence type is auto-derived today.
- `work_units.genome_version_id` FK added so a version's Work Units are actually scoped to that import (added via migration 4).

**Two real bugs found and fixed while testing the import path:**
- Bug 3: top-level `extra="forbid"` rejected benign metadata. Fixed by scoping strictness to `WorkUnitImport` only.
- Bug 4: `SET LOCAL app.current_client_id` reverts at every `db.commit()` — and `apply_verdict()`/the import flow commit multiple times per request, so RLS scoping silently vanished after the first commit and broke `db.refresh()`. Fixed by switching to session-scoped `SET`, re-applied fresh on every request via `tenant_db()`.

Also caught: `VARCHAR(80)` truncation on `current_condition`/`desired_condition` against this HR sample's verbose real-world text — clipped safely in the mapping layer (with an ellipsis) rather than widening the column, since V8 intends these as short state labels.

All test/demo tenant data cleaned up afterward.

## What's Built But Not Yet Wired Up

`OrgApiKey`/`TenantDbDep` auth dependency exists and is used by the genome router only (`POST /import`, `GET /genome/{id}`, `GET /gqs`, `POST /ratify`) — proven via HTTP 401 for no-key/wrong-key. Every other router (`work_units`, `spec`, `census`, etc.) still uses the old global `spec_api_key` (`dev-spec-key-change-me` default, **not removed**).

`pgcrypto` enabled; `PiiFieldValue` table exists and the encrypt/decrypt service is proven live.

`ConsentReceipt`, `UploadedFile`, `ReviewQueueItem` tables exist in the schema but **nothing writes to them yet** — no consent-capture flow, no file upload endpoint (so no sha256 fingerprinting happens anywhere in the running system), no format-classifier that would populate the review queue.

## What's Not Started — Honestly

- **Parser v2** in full: fuzzy classifier + synonym dict, confidence-scored review queue, canonical micro-step schema, Two-Track mapping (deterministic Track A + guardrailed LLM Track B), F1 Split Engine, Dedup Engine. **No CSV/Excel upload path exists — JSON-body import only.** We parsed nothing from the 5 raw CSV files ourselves; the 14-unit sample JSON was a pre-made fixture handed to us. The "62 WUs from an 87-step parse" figure is the planning docs' own unverified claim about a full parse nobody — including us — has actually run.
- Work Graph auto-detection beyond simple Sequence-from-dependencies: no Shared Object / Shared Resource / Reciprocal detection, no bottleneck/bus-factor-1 flagging.
- `GET /diff` (semantic business-language diff), `GET /business-objects` (progressive disclosure L1/L2/L3), `GET /automation-index` (+ bottleneck view + cost-per-verified-unit + rule debt — note: this needs `CostProfile` data, which the import path does not currently populate), `POST /keys/rotate`.
- Consent-receipt creation flow + 90-day purge cron.
- File upload endpoint + sha256 fingerprinting (see above — genuinely not built, not just "not wired").
- 50-file test corpus (including a "File 6" that breaks naive `Step #` detection).
- Automated HTTP RLS regression test (manual proof done, not automated).
- Migrating legacy routers off the global `spec_api_key` onto per-org keys.
- Demo video.

## P0 Blockers — Fixed vs Remaining (corrected)

**Fixed, with accurate mechanism:**
- `org: Trianz` hardcoded → not hardcoded in application code; the sample fixture uses `Client A`. Detected as a violation (not rejected) if present in an import payload — no `orgs` table exists, `clients` is the tenant boundary.
- `total_work_units` drift → removed from the FIXED fixture; no code currently derives/serves this field on read (no `GET` endpoint returns a full genome export in the original JSON shape yet).
- `variant` extra field → moved to `context.variants[]` in the FIXED fixture; enforced by `WorkUnitImport`'s `extra="forbid"` for any NEW import (not retroactively, and not at the top level).
- Orphan dependency → fixed in the FIXED fixture by removing out-of-slice references; **guaranteed absent from GQS-passing imports by score arithmetic**, not by a Pydantic/FK-level rejection.
- Provenance string → structured object in the FIXED fixture (`file_id, row, col, hash_sha256, timestamp, interview_id, consent_receipt_id, source_type, notes`) — **no `file_name` field**, and none of these sub-fields besides `source_type` are pattern-validated.
- `regulatory_register_link` free text → array of strings in the FIXED fixture; matched/auto-created against `regulatory_entries.regulation` — **no format enforcement, no pre-existence requirement.**
- PII scrubbed in the sample fixtures (hand-done, name list, not the general-purpose scanner) — real names → Person A/B/etc., emails → fake, UAN → `XXXX-XXXX-XXXX-XXXX`.
- Alembic init + 4 migrations (see above) — **no separate `orgs` table**; tenant boundary is `clients`.
- Pydantic `WorkUnitImport` — 18 fields present and typed; `extra="forbid"` on this model only.
- GQS formula — implemented and blocking `POST /api/genome/import` if <90; proven 40 vs 94.29.

**Remaining** (unchanged from before, confirmed accurate):
- Parser v2 full implementation, incl. file upload + fingerprinting.
- Work Graph auto-detection beyond Sequence.
- `GET /diff`, `GET /business-objects` L1/2/3, `GET /automation-index`, `POST /keys/rotate`.
- Consent receipt creation + 90-day purge cron.
- 50-file test corpus.
- Automated HTTP RLS regression test.
- Migrating legacy routers off the global spec key.
- Demo video.

## Tests and Verification

28/28 tests pass (24 original + 4 GQS). End-to-end HTTP proof reproduced above. PII proven live via `pgp_sym_encrypt`/`pgp_sym_decrypt` round-trip.

Nothing committed — still on `feat/genome-import-foundation`.

## Acceptance Criteria for a New Engineer

A new engineer should be able to, using these 3 files:
1. Read `Scout-Enhanced-Vision.md` for why Scout exists, the moat, and why HR Ops is the wedge.
2. Read `Scout-Reference.md` for the 18-attr contract **as actually implemented** (including which validations are real vs aspirational), the VERDICT gates, the GQS formula, and which of the 15 No-Cracks Gates are live vs specified-only.
3. Read this file for exactly what's tested and real vs built-but-unwired vs not started.
4. Build Parser v2 (starting with real file upload + fingerprinting, since that doesn't exist at all yet), the remaining APIs, consent cron, 50-file corpus, and pass GQS>90 + the RLS 404 test — now as an automated regression, not a manual script.

Date: 2026-08-26 | Branch: feat/genome-import-foundation | Tests: 28/28 | GQS: 40 blocked vs 94.29 pass | Nothing committed yet
