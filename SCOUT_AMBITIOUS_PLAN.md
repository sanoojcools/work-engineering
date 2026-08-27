# Scout — Ambitious High-Leverage Plan
**Date:** 2026-08-27  
**Branch:** `feat/genome-import-foundation` (uncommitted)  
**Verified baseline:** tests **28/28** · GQS **40 blocked vs 94.29 pass** · Postgres via docker-compose  
**Source-of-truth:** V8 FULL > `services/verdict.py` (exactly 4 H2 gates) > Master Plan v0.4 + AMBITIOUS v0.6 + CONTINUE v0.6.1 > 5 HR Excels (sample only)  
**Rules in force:** no org-name hardcoding · no real PII (Person A/B, fake emails, UAN `XXXX-XXXX-XXXX-XXXX`) · no invented thresholds (anchors 1/3/5 only; 2/4 interpolation) · no extra fields on a Work Unit · no claiming unbuilt validators as live

This plan is written against the *corrected* trio (`Scout-Enhanced-Vision.md`, `Scout-Reference.md`, `Scout-State.md`). It does not treat the prior doc revision as truth.

---

## 0. What is actually true (do not re-inflate)

### Live and proven
- Alembic **4** migrations, zero drift.
- RLS: `wep_app` non-superuser + `SystemSessionLocal` for bootstrap. HTTP: Org A `GET` 200 / Org B `GET` 404 fail-closed; no/wrong `X-Spec-Key` → 401. **Manual script only — no automated HTTP RLS pytest.**
- GQS in `app/services/gqs.py` blocks `POST /api/genome/import` if score &lt; 90. SCRUBBED fixture → **40** (62 detected violations; slice-orphan math, not a single `WU-REC-01` story). FIXED fixture → **94.29**. Four tests lock the numbers.
- JSON-body import path: GQS → Pydantic → rows + Sequence edges from resolvable `dependencies` → `GenomeVersion` + audit (`genome.import.attempt` / `genome.import.committed` only).
- `WorkUnitImport` `extra="forbid"`. Top-level `GenomeImportRequest` is `extra="ignore"` — stray `org` / `total_work_units` / `source_files` are **scored by GQS**, not schema-rejected.
- PII regex + pgcrypto encrypt/decrypt + 3-char redaction: proven on email/UAN-*shaped* text.
- VERDICT 4 gates untouched in `services/verdict.py`. No 5th gate.
- `current_condition` / `desired_condition` clipped to VARCHAR(80) with ellipsis at write time.

### Specified as built before — actually not
- No `orgs` table. Tenant boundary is **`clients`**.
- No id / `hash_sha256` / `RR-` / trigger-verb regex. No schema-level orphan reject (GQS arithmetic + silent skip of unresolved deps).
- Regulatory links **upsert** into existing `regulatory_entries.regulation` — not a must-exist FK to a `regulatory_register` table.
- Work graph uses existing `work_edges` + `EdgeType`. **Sequence only.**
- No file-upload endpoint. **No server-computed sha256.** Any hash in provenance is caller-supplied.
- `ConsentReceipt`, `UploadedFile`, `ReviewQueueItem` tables exist; **nothing writes to them.**
- Legacy global `spec_api_key` (`dev-spec-key-change-me` default) **still live** on `work_units` / `spec` / `census`.
- `GET /api/genome/{id}` is a thin payload (`version_id, gqs, ratified, work_unit_count, work_units[]` in DB-column shape). Not the rich WEP contract.
- Function Pack SDK, F1 split, dedup, Two-Track mapper, semantic `GET /diff`, `GET /business-objects`, `GET /automation-index`, key rotation, 90-day purge: **not built.**
- Kappa is **caller-supplied**, not measured.
- **Net 15 No-Cracks Gates:** 1 fully live (#15 RLS) · ~6 partial · ~8 specified-only. A genome can clear GQS &gt;90 without all 15 being separate blockers.

**Honest pitch line (use this, not the 7-day consulting line):**  
*Foundation is real: multi-tenant storage, a quality gate with a measured score, field-level PII encryption. The engine that turns interviews and spreadsheets into that genome automatically is the next phase.*

---

## 1. Ambition thesis

Do not spend the next cycle “completing the 15 gates checklist.” That produces documentation gravity and a still-un-demoable product.

Spend it building the **shortest path to a CHRO/VC room where a stranger can:**

1. Upload a time-motion spreadsheet (not paste JSON).
2. Watch Scout refuse a dirty genome (GQS 40-class) and accept a clean one (GQS ≥90).
3. Walk Business Objects → Work Units → 18 attrs (progressive disclosure).
4. See a bottleneck / hours-saveable index, including a bus-factor-1 flag derived from data.
5. Ratify a version, fetch it as Org A, and fail to fetch it as Org B — with the global legacy key **gone**.

That path is the moat *and* the revenue conversation: Enforcement Gateway + GQS + observed provenance + PII/RLS, demonstrated rather than claimed.

Parser v2 is ambitious **if it is Track A first** (deterministic, logged, review-queued). Track B LLM assist is a second milestone, behind a guardrail that rejects output not grounded in `raw_text`. Pack SDK and finance-pack-in-a-week are milestone 3 — they only mean something after one function has a closed ingest→playback→handoff loop.

---

## 2. Highest-leverage actions (priority order)

Each item is chosen because it unlocks the next visible milestone, not because it matches a planning-doc heading.

| # | Action | Why it is the leverage point | Unlocks |
|---|---|---|---|
| 1 | **Commit the branch as `foundation-verified`, freeze the honesty contract** | Uncommitted 28/28 + GQS 40/94.29 is a local anecdote. A tagged commit is the only baseline a second engineer can extend without re-litigating what Pydantic actually checks. | Every later PR; stops doc-drift. |
| 2 | **File upload + sha256 + `UploadedFile` write + Observed provenance stamp** | Today provenance hashes are caller-supplied — the tamper-evident claim is false in production. Upload is the missing Stage 4 primitive and the only way a CHRO demo is not “we pasted a fixture.” | Parser v2, Gate 4, GQS Observed% that means something. |
| 3 | **Parser v2 Track A: format classifier + synonym dict + review_queue + canonical micro-step → 18 attrs (deterministic only)** | Without this, Scout is an importer of already-shaped JSON. Track A is the moat-adjacent work (rules, confidence, human queue). Track B LLM is deferred until Track A F1 on a held-out file is measured. | Bulk ingest demo; 50-file corpus becomes useful. |
| 4 | **`GET /business-objects` L1/L2/L3 + BO-scoped ratify** | CHRO pitch is “ratify objects, not a thousand fields.” `POST /ratify` today is whole-version only. Progressive disclosure is the Playback 2 surface. | Room-ready walkthrough; partial approval story. |
| 5 | **`GET /automation-index` + Shared Resource / bus-factor-1** | VC asks “what do I save before I write code?” Sequence edges already exist; the index is a read-model over `authority` overlap × `time_per_case_min × volume_per_month`. Flag bus-factor-1 when one authority owns &gt;3 WUs and load &gt;6 hrs/day (**published planning rule — implement as named constant, do not invent a new threshold**). | ROI slide; bottleneck conversation. |
| 6 | **Kill the global spec key + automate HTTP RLS + `POST /keys/rotate` + audit ratify/read** | G6 is currently true for four genome routes and a lie for the rest of the API. A security reviewer will find `dev-spec-key-change-me` in five minutes. | Honest Enforcement Gateway claim; CHRO trust. |
| 7 | **Consent write-path + 90-day purge job** | Table exists; promise does not. Do not say “DPDP aligned” in a CHRO room until a receipt is created on capture and a daily job deletes expired transcripts. | Compliance pitch that survives diligence. |

**Park until after the demo loop exists:** Function Pack SDK + `scout pack validate`, finance pack, semantic `GET /diff` templates, 50-file golden corpus as a *gate* (use a 8–12 file slice first), demo video last (film the working loop, do not storyboard a missing product).

---

## 3. Plan of record — four slices

Cadence assumption: one focused engineering stream on `feat/genome-import-foundation` then stacked PRs. Dates are sequence, not calendar promises.

### Slice 0 — Freeze the foundation (do this first, same day)

**Goal:** make the corrected state the git truth.

- Commit current tree on `feat/genome-import-foundation` with message that cites: Alembic 4, RLS bugs 1–4, GQS 40 vs 94.29, 28/28, JSON import only, global key still present.
- Add `docs/HONESTY.md` (short): list of validators that exist vs do not (copy the 18-attr “as implemented” table from Reference). Future PRs may not claim a regex/FK that is not in the test file.
- Add one test that will fail if someone re-enables top-level `extra="forbid"` (benign `source_files` must still import; `variant` on a Work Unit must still 422).
- Do **not** “fix” GQS by changing the formula. Formula is v0.4-introduced and locked by four tests.

**Exit:** `git log -1` on the branch; CI green; honesty doc merged.

### Slice 1 — Observed ingest (upload + Track A parser)

**Goal:** a file enters the system, is fingerprinted, classified, mapped or queued — no LLM.

**Build**
1. `POST /api/genome/upload` (per-org key, tenant-scoped).
   - Accept CSV / XLSX (PDF later).
   - Persist `UploadedFile`: `file_id`, original name, bytes hash **sha256 computed server-side**, size, `client_id`, uploaded_at.
   - Never store raw PII-bearing cells in logs; run existing `services/pii.py` on extracted text before audit lines.
2. Format classifier:
   - Synonym dict for step columns: `Step #` ≈ `{Step #, Step No, Sl No, Activity, Task, S.No, No}` with Levenshtein distance ≤ 2 (planning rule — do not invent a new distance).
   - Metadata block hints: Workflow Name, Outcome, Trigger, Frequency, SPOC.
   - Confidence 0–1. **&lt; 0.7 → `ReviewQueueItem`** (table already exists). Do not guess.
3. Canonical micro-step row (internal, not the 18-attr contract yet):
   `step_id_raw, what_happens_raw, decision_branches_raw, system_raw, step_type_raw, data_fields_raw, docs_policies_raw, automation_tag_raw, time_per_case_raw, frequency_raw, volume_raw, agent_notes_raw, file_id, row, hash_sha256, raw_text`.
4. Track A mapper (deterministic, block-list of columns → attrs):
   - ID / BO / Current / Desired / Trigger / Provenance / RR IDs only.
   - Stamp provenance as `source_type=observed`, `file_id`, `row`, **server** `hash_sha256`.
   - Clip current/desired to 80 chars in the mapping layer (already the write rule).
   - Anything that needs judgment (variants, acceptance, evidence, verification prose) stays empty → fails completeness / goes to review_queue rather than an LLM fill.
5. Hand off mapped units to the **existing** GQS + import pipeline. No second writer.

**Explicitly out of Slice 1:** Track B LLM, F1 split engine, dedup engine, PDF OCR.

**Acceptance**
- Upload of the sample HR spreadsheet (org-agnostic, PII already scrubbed or scrubbed on ingest) produces an `UploadedFile` row whose sha256 matches an independent `sha256sum`.
- A deliberately broken header file (the “File 6” idea: no recognizable Step column) lands in `review_queue` with confidence &lt; 0.7, not a hallucinated genome.
- A Track-A-mappable slice either (a) imports with GQS ≥ 90 or (b) returns 400 with the real GQS reasons list — never a silent coerce.
- No org name appears in code or in stored genome JSON; tenant key is `clients.id`.
- New tests: upload hash, classifier miss → queue, Track A happy path → import 201, dirty path → 400 GQS &lt; 90.

**Risk to kill early:** trying to emit 14 polished WUs from raw Excel in week one. Success is *classified + fingerprinted + either queued or GQS-gated*, not “parser matches the hand-built FIXED fixture on day one.”

### Slice 2 — Playback surface (the room demo)

**Goal:** someone who is not the author can run Playback 2 without SQL.

**Build**
1. `GET /api/genome/{version_id}/business-objects`
   - L1: distinct `business_object` values + WU counts + ratified flag per BO.
   - L2: `?bo=` → WU list (`id, name, current_condition, desired_condition, autonomy if present`).
   - L3: `?wu=` → 18 attrs as imported (arrays remain arrays on this API even if DB columns are joined strings — reconstruct on read).
2. Extend ratify:
   - Keep whole-version `POST /ratify` (already works).
   - Add `POST /ratify` body `{ business_objects: [...], work_unit_ids?: [...] }` for partial approval. Unapproved WUs stay `ratified=false`; version-level ratified only when all WUs in scope are approved.
   - Write `AuditLog` for ratify (today it does not).
3. `GET /api/genome/{version_id}/automation-index`
   - Counts by autonomy level when a `verdict` block exists; otherwise return `verdict_missing` rather than inventing L-scores.
   - `total_hours_current` = Σ (`time_per_case_min` × `volume_per_month` / 60) where both numbers exist; omit rows without numbers — **do not impute**.
   - Saveable hours: only WUs with supplied autonomy ≥ L4 *and* both time and volume present. If `CostProfile` is empty, return hours only and `cost_per_verified_unit: null` — do not invent $60.
   - Shared Resource detector: same `authority` string on &gt;3 WUs AND sum(time×volume) &gt; 6 hrs/day → edge type `shared_resource` + `bus_factor_1: true`. Log `detection_method=authority_overlap_v1`.
   - Shared Object: same `business_object` on ≥2 WUs → `shared_object` edges.
   - Reciprocal / DFS cycles: include if cheap (DFS on Sequence edges); otherwise ship Sequence + Shared Object + Shared Resource and leave Reciprocal as `not_computed` rather than a fake empty list.
4. Thin UI or scripted HTML playback is enough for the first room (authenticated GET pages). Do not block on a product frontend.

**Acceptance**
- From a GQS-passing version: L1 lists BOs, L2 lists WUs, L3 shows 18 attrs with `context.variants` not a top-level `variant`.
- Org B requesting the same URLs → 404.
- Automation index on the FIXED 14-unit sample produces a numeric hours figure **only from fields present in the fixture**; snapshot the number in a test so it cannot drift silently.
- Bus-factor-1 fires only when the published overlap rule is met; add a fixture where it must not fire.

### Slice 3 — Enforcement + consent (make the pitch non-false)

**Goal:** G6 and DPDP lines become true for the running system, not just the new router.

**Build**
1. Migrate `work_units`, `spec`, `census` off global `spec_api_key`. Remove default `dev-spec-key-change-me` from config. Fail closed if no per-org key.
2. `POST /api/org/keys/rotate` — hash-at-rest, one active key, previous key grace window logged, audit row.
3. Automated HTTP RLS pytest (the cleaned-up manual script, as a real test): two clients, import as A, GET as A 200, GET as B 404, wrong key 401, missing key 401. Run in CI against docker-compose Postgres.
4. Consent:
   - `POST /api/consent/receipts` creates `ConsentReceipt` (purpose, client_id, created_at, expires_at = +90d).
   - Interview/upload endpoints that do not yet exist must require a `consent_receipt_id` before they are marked `observed` from a human source. File-only Observed (spreadsheet) may use `source_type=observed` with file provenance and `consent_receipt_id=null` **only if** the file is an operational export, not a transcript — document that rule so it is not used as a loophole.
   - Daily job: delete or tombstone transcript blobs (when they exist) past 90 days; log purge counts. Until transcripts exist, the job still runs and reports zero — prove the cron path.
5. Tighten import validators **only with tests**, and only the ones that prevent silent garbage:
   - Optional Slice 3 add-ons (each behind a test, none silently changing GQS 94.29 of the FIXED fixture): `id` pattern `^WU-[A-Z]+-[0-9]+[A-Z]?$`, `hash_sha256` `^[a-f0-9]{64}$` when present, `regulatory_register_link` items recommended `RR-` prefix (warn + GQS violation, or accept + stub — pick one and test; do not silently change upsert behavior without a snapshot test).

**Acceptance**
- Grep for `dev-spec-key-change-me` returns zero runtime defaults.
- CI job `test_http_rls.py` is green and is the replacement for the deleted manual script.
- Rotate key → old key 401 on genome routes within the documented grace policy.
- Consent receipt row exists after the new endpoint; purge job is schedulable.

---

## 4. After the loop exists (ambitious, not concurrent)

Only start these when Slice 1–2 acceptance is green.

1. **Track B LLM assist** for `context.variants[]`, `acceptance_criteria`, `evidence_required`, `failure_semantics`, `verification_method`. Guardrail: every generated span must be a substring of `raw_text` or the unit is rejected to `review_queue`. No free-form invention.
2. **F1 Split Engine** — split when &gt;1 BO or &gt;1 authority or &gt;1 verification method or &gt;1 independently verifiable acceptance criterion. Persist `split_reason`. Do not target “11 steps → 16 WUs”; that V8 anecdote is not a KPI.
3. **Dedup Engine** — key = hash(BO + desired_condition + variant key). Same BO+desired, different variant → merge into `context.variants[]`. Exact cross-file dup → one WU, provenance array of both `file_id|row|hash`.
4. **Function Pack SDK** (5 files + `scout pack validate`) once Track A has parser hints worth extracting. First pack = current HR sample ontology, *then* a finance pack as the reuse proof. Packs must not hardcode a company name.
5. **`GET /diff`** semantic sentences over version_history (v1 Inferred / v2 Detailed / v3 Ratified). Requires version-type gating (Gate 11) which does not exist yet — implement type on `GenomeVersion` first.
6. **50-file corpus** including a header-breaking file. Use it as a regression suite for classifier confidence, not as a vanity count. Start with 8–12 files; 50 is the hardening target.
7. **Demo video** filmed against the live loop: Founder-why placeholder → upload → GQS fail/pass → BO playback → automation index → Org B 404 → key rotate. Do not animate stages 1–3 that still have no capture UI.

---

## 5. VC / CHRO demo script (only after Slice 2)

Do not use numbers that are not produced by the running index. Do not promise consent purge until Slice 3.

1. **Setup (30s):** two tenants, per-org keys. No global key.
2. **Refuse garbage:** upload or POST the SCRUBBED fixture → 400, GQS **40**, reasons list visible.
3. **Accept clean:** FIXED fixture or Track A output → 201, GQS **94.29** (or the new measured score — print whatever the code returns, never a remembered number if the fixture changed).
4. **Playback:** L1 BO list → pick one object → L2 WUs → L3 one unit’s 18 attrs. Show `context.variants[]`. Ratify that BO.
5. **Index:** hours currently spent (computed), targets with verdict ≥ L4 if present, bus-factor-1 if the rule fires. If cost is null, say so.
6. **Isolation:** replay GET as the second tenant → 404. Wrong key → 401.
7. **What we will not say in the room:** “7 days vs 90 days,” “85%+ Observed” unless Observed% is on the screen from this file, “legacy key removed” before Slice 3, “Function Pack flywheel” before a second pack exists, any real personal name / email / UAN.

---

## 6. Workstream map (who-does-what shape)

Even as a single engineer, keep the PRs separable so none of them re-opens verdict.py.

| PR | Touches | Must not touch |
|---|---|---|
| 0 Foundation commit + honesty doc + extra=forbid regression | docs, one test | `gqs.py` formula, `verdict.py` |
| 1a Upload + sha256 + UploadedFile | new router, files table write | parser intelligence |
| 1b Classifier + review_queue | parser_hints in code or yaml, ReviewQueueItem writes | LLM client |
| 1c Track A mapper → existing import | mapping layer, clip-80 reuse | GQS weights |
| 2a business-objects L1/L2/L3 | read models | write path |
| 2b partial ratify + audit | ratify router, AuditLog | RLS policy rewrite |
| 2c automation-index + 2 edge detectors | new service, `work_edges` inserts | CostProfile invention |
| 3a retire global key + rotate | auth deps, all leftover routers | genome GQS |
| 3b HTTP RLS pytest | tests against live docker Postgres | production data |
| 3c consent + purge cron | ConsentReceipt writes, job runner | parser |

`services/verdict.py` stays frozen unless V8 itself changes. Dual-scoring remains caller-supplied until a second scorer exists; do not fake kappa.

---

## 7. Test contract for the ambitious path

Keep 28/28 green. Add tests that lock the new honesty:

- GQS snapshot: SCRUBBED = 40, FIXED = 94.29 (update snapshots only with a written reason).
- Import container accepts `source_files`; Work Unit rejects top-level `variant`.
- Upload sha256 matches fixture bytes.
- Classifier miss → `review_queue`, not import.
- Track A path either 201 + GQS ≥ 90 or 400 + reasons.
- BO L1/L2/L3 shape tests on the 14-unit FIXED sample.
- Automation index: no imputed cost; hours only from present sla fields; bus-factor-1 true/false fixtures.
- HTTP RLS matrix automated.
- Grep test or config test: no runtime default global spec key.
- PII: encrypt/decrypt round-trip still green; redaction preview `abc***` shape.
- No test fixture contains a real personal name, personal email, or real UAN.

---

## 8. Risks and non-goals

**Risks**
- Re-introducing top-level `extra="forbid"` will break benign metadata and look like quality. Forbidden by Slice 0 test.
- Tightening RR / id regex without a snapshot will knock FIXED’s 94.29 under 90 and freeze import. Any new validator ships with a fixture update in the same PR.
- Computing “saveable $” from a made-up rate. Hours only until `CostProfile` is a real table with a real source.
- Running Track B before Track A has a confidence model — that recreates “LLM + Excel parser,” which Vision says is not the moat.
- Treating GQS &gt;90 as “all 15 gates passed.” It is not. Demo language must say “quality gate passed”; gate table stays in Reference as mixed live/partial/specified.

**Non-goals for this plan**
- Inventing a 5th VERDICT gate or a mean→level formula.
- Widening VARCHAR(80) for current/desired.
- New `orgs` / `regulatory_register` / `work_graph_edges` tables when `clients`, `regulatory_entries`, and `work_edges` already exist.
- Hardcoding a company name, a dollar rate, or a 62-WU full-parse claim. The 62 figure remains an unverified planning number about a parse nobody has run.
- Surveillance-shaped features (always-on recording, no-consent Observed transcripts).

---

## 9. One-page scoreboard

| Milestone | Signal it is done |
|---|---|
| Foundation frozen | Commit on `feat/genome-import-foundation`; 28/28; honesty doc |
| Observed ingest | Server sha256 on `UploadedFile`; File-6-class sheet → review_queue; clean sheet → GQS gate |
| Room demo | BO L1/L2/L3 + index + Org A 200 / Org B 404 in one script |
| Honest G6 | Global key gone; rotate works; RLS pytest in CI |
| Honest DPDP line | Consent receipt write + purge job exists |
| Parser becomes a factory | Track B + F1 + dedup + pack CLI — only after the five rows above |

**Current scoreboard:** GQS 40 vs 94.29 and RLS 404 are real. Upload, parser, BO playback, automation index, key retirement, consent — not started. That is the entire ambitious program. Do them in the order above and the product becomes demonstrable without writing a fourth planning novel.
