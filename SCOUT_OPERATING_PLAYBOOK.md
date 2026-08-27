# Scout Operating Playbook
**Status:** binding execution contract  
**Date:** 2026-08-27  
**Decision already made:** follow `SCOUT_AMBITIOUS_PLAN.md` slice structure; fold in one item from v0.7 — unresolved dependencies become `ReviewQueueItem`s, not silent skips.  
**Branch now:** `feat/genome-import-foundation` (nothing committed)  
**Tag sequence (do not skip):** `v0.7-foundation-corrected` → `v0.7-ingest-track-a` → `v0.7-playback-surface` → `v0.7-security-closed` → `v0.8-demo-ready-minimum` → `v0.8-demo-ready`  
**Verified numbers that may be spoken:** tests **28/28** · GQS **40** blocked vs **94.29** pass · Alembic **4** · Sequence edges **13** on the FIXED 14-unit import  
**SOTA hierarchy:** V8 FULL → `services/verdict.py` (four H2 gates only) → Master Plan v0.4 + AMBITIOUS v0.6 + CONTINUE v0.6.1 → 5 HR Excels, sample only

This document is how Scout is *operated*: what a session may touch, what a PR must prove, what a room may say, and when to stop. It is not a seven-day schedule. Every prior “quick” feature on this branch produced a real bug (RLS superuser bypass, SET LOCAL dying at `commit()`, top-level `extra="forbid"`, VARCHAR(80) truncation). Operate as if the next feature will too.

Companion files (read in this order before any commit):
1. `Scout-Enhanced-Vision.md` (corrected) — why, wedge, honest pitch lines  
2. `Scout-Reference.md` (corrected) — 18 attrs *as implemented*, 15 gates live/partial/specified  
3. `Scout-State.md` (corrected) — what was actually tested  
4. `SCOUT_AMBITIOUS_PLAN.md` — why this slice order  
5. This playbook — how to execute without re-inflating

---

## A. Operating principles (non-negotiable)

1. **Do not invent. Do not re-inflate.** If a validator, table, endpoint, hash, or dollar figure is not in the corrected trio + running tests, it is not “done.”
2. **Freeze list — do not touch unless V8 itself changes:**
   - `services/verdict.py` (L1–L6 + four gates: compliance=1→L2, reversibility=1→L3, impact=1→L3, no-evidence→L2)
   - `app/services/gqs.py` formula and weights  
   - VARCHAR(80) on `current_condition` / `desired_condition` (clip + ellipsis in the mapping layer)
   - No new `orgs`, `regulatory_register`, or `work_graph_edges` tables (`clients`, `regulatory_entries`, `work_edges` already exist)
3. **Tenant key is `clients.id`.** Never introduce an `orgs` table “to match the pitch.”
4. **No org-name hardcoding. No real PII.** Fixtures: Person A/B, `person_a@example.com`, UAN `XXXX-XXXX-XXXX-XXXX`. Sample company names in old JSON are violations to detect, not strings to copy into application code.
5. **No 5th VERDICT gate. No mean→level formula. No $60 (or any) imputed rate.** Hours only until a real `CostProfile` row exists with a real source.
6. **GQS ≥ 90 means the quality gate passed.** It does not mean “15 No-Cracks Gates passed.” Room language follows that sentence exactly.
7. **Kappa is caller-supplied today.** Do not compute a fake dual-score.
8. **One slice per session.** Merge, tag, review, *then* open the next slice. No bundling upload + auth migration + regex tightening into one PR.
9. **Every PR has a “must not touch” column and a failing-test-first acceptance list.** If the acceptance test was not written before the feature, the feature is not done.
10. **Stop and surface the bug.** If RLS leaks, GQS 94.29 moves without a written snapshot reason, or a fixture gains a real email, halt the slice.

---

## B. What the running system actually does today

Use this as the pre-flight checklist. If local reality differs, fix the doc in the same PR as the discovery — do not quietly “correct” code to match an older inflated doc.

| Surface | Reality |
|---|---|
| Import | `POST /api/genome/import` JSON body only. GQS on raw dict → Pydantic → DB write. |
| Container schema | `GenomeImportRequest` `extra="ignore"`. Benign `source_files`, `automation_index`, even stray `org` do **not** 422. GQS scores them. |
| Work Unit schema | `WorkUnitImport` `extra="forbid"`. Top-level `variant` **does** 422. |
| Orphans | Unresolved `dependencies[]` IDs: **no edge created, no schema reject.** GQS Zero-Orphan + Zero-Violations both zero → cap 80 &lt; 90. |
| Regulatory links | Strings matched to `regulatory_entries.regulation`; miss → **stub upsert**. No `RR-` prefix check. |
| Edges | Existing `work_edges`. Auto-derived type = **Sequence** only. |
| Auth (genome router) | Per-org `X-Spec-Key` via `OrgApiKey` / `TenantDbDep`. No key / wrong key → 401. |
| Auth (everything else) | Legacy global `spec_api_key`, default **`dev-spec-key-change-me` still present.** |
| RLS | `wep_app` role + session-scoped `SET` via `tenant_db()`. Org A 200 / Org B 404 proven **manually**. No pytest. |
| PII | Regex + pgcrypto + 3-char `***` redaction, proven on shaped text. |
| Files / consent / review | Tables `UploadedFile`, `ConsentReceipt`, `ReviewQueueItem` exist. **Zero writers.** |
| sha256 | Never computed by Scout. Provenance hash is caller-supplied. |
| GET genome | `{version_id, gqs, ratified, work_unit_count, work_units[]}` in DB-column shape (`inputs` joined string). |
| Ratify | Whole-version only. Not audit-logged. |
| Pack SDK / Parser v2 / F1 / dedup / diff / automation-index / key rotate / purge | Not built. |
| 15 gates | #15 live · ~6 partial · ~8 specified-only. |

**Honest pitch line (the only one allowed until Slice 2+3 land):**  
*Foundation is real: multi-tenant storage, a quality gate with a measured score, field-level PII encryption. The engine that turns interviews and spreadsheets into that genome automatically is the next phase.*

---

## C. Session operating model

### C.1 Definition of a session
A session is one slice (or one PR inside a slice). It starts by reading this playbook §A–B and the slice spec below. It ends when:
- targeted tests pass **and** full `pytest` is 28/28 plus new tests,
- `alembic check` is clean if a migration was added,
- GQS snapshots still 40 / 94.29 unless the PR contains a written snapshot-reason,
- the slice tag is cut,
- the operator stops and asks for review before the next slice.

### C.2 PR hygiene
- Branch from the previous tag, not from an untagged dirty tree.
- Subject line names the slice and the freeze: `feat(slice1a): upload sha256 (no gqs/verdict touch)`.
- Body contains: intent, files touched, files forbidden, test names, rollback note.
- No “while I was here” refactors across freeze-list files.

### C.3 Local verification ritual (every session)
```
docker-compose up -d postgres
alembic upgrade head
alembic check
pytest -q
# expected: prior 28 passing + only the tests this slice added
```
If Postgres was already running from a previous dirty session, recreate test tenants or the RLS tests will lie.

### C.4 Doc hygiene
Any time implementation status changes, update **in the same PR**:
- `Scout-State.md` — what’s tested
- `docs/HONESTY.md` — validator matrix (created in Slice 0)
- this playbook’s §B table if a row flips from “not built” to “live”

Do not update Vision pitch lines to sound finished.

---

## D. Slice 0 — Honest baseline (session 1, low risk, first)

**Tag out:** `v0.7-foundation-corrected`  
**Why first:** 28/28 + GQS 40/94.29 on an uncommitted branch is an anecdote. A tagged commit is the only baseline a second engineer can extend without re-litigating Pydantic.

### D.1 Actions
1. **Commit the corrected source of truth + code that matches it.**  
   Stage only what exists in the real repo. Expected set (do not invent files):
   - corrected docs: `Scout-State.md`, `Scout-Enhanced-Vision.md`, `Scout-Reference.md`
   - plans: `SCOUT_AMBITIOUS_PLAN.md`, this playbook, v0.7 note if present
   - `alembic/`, `app/`, `schemas/`, `services/`, `routers/`, `samples/`, `tests/`, `docs/` if present  
   **Do not** add Parser v2 code in this commit.

   Suggested message (edit only if the tree differs; do not soften the honesty):
   ```
   feat: foundation corrected

   Alembic 4 zero drift; RLS wep_app + SystemSessionLocal;
   GQS 40 vs 94.29 locked by 4 tests, 28/28;
   import: container extra=ignore, WorkUnit extra=forbid;
   orphans via GQS arithmetic not schema reject;
   regulatory_entries stub upsert;
   file upload + server sha256 NOT built;
   legacy global spec key NOT removed;
   Parser v2 NOT built;
   15 gates: 1 fully live, ~6 partial, ~8 specified-only.
   ```

2. **Tag** `v0.7-foundation-corrected` on that commit.

3. **Add `docs/HONESTY.md`** — copy the corrected Reference 18-attr list into a table with two columns only: *Enforced today* | *Specified, not enforced*. Do not add new patterns in this file. Required rows (source: corrected `Scout-Reference.md`):

   | Attr | Enforced today | Specified, not enforced |
   |---|---|---|
   | id | `str`, min 1, max 40 | `^WU-[A-Z]+-[0-9]+[A-Z]?$` |
   | name | min 1, max 200 | verb-noun format |
   | business_object | min 1; auto-creates `EntityType` | pack ontology allow-list |
   | current_condition | min 1; clipped to 80 + ellipsis at write | — |
   | desired_condition | same clip | — |
   | context | `{decision_branches, variants[]}`, extra=forbid | — |
   | trigger | min 1 | verb-content check |
   | input | `list[str]` min 1 at API; joined to text col | native array column |
   | authority | min 1; PII-scanned | — |
   | actor_constraints | min 1; PII-scanned | — |
   | acceptance_criteria | `list[str]` min 1 at API; joined | native array column |
   | evidence_required | same; PII-scanned | native array column |
   | verification_method | free text → enum heuristic, default `human_spot_check` | strict input enum |
   | sla_timing | structured, **all fields optional**, extra=forbid; only `time_per_case_min` mapped to `sla_hours` | `gt=0` on time; other fields read back |
   | dependencies | `list[str]`, default []; unresolved = skip edge | schema/FK reject |
   | failure_semantics | min 1 | — |
   | regulatory_register_link | `list[str]`; upsert stub on `regulatory_entries.regulation` | `RR-` prefix; must-exist FK |
   | provenance | extra=forbid; **only `source_type` pattern-validated** `^(observed\|declared\|inferred\|designed)$` | `hash_sha256` `^[a-f0-9]{64}$`; server-computed hash; `file_name`; consent existence |

   Also record: container `extra="ignore"`; GQS runs on raw dict before Pydantic; kappa is caller-supplied; no file writer; global key still defaulted.

4. **Add `tests/test_top_level_extra_forbid_regression.py`** (locks Bug 3).

   Cases:
   - Payload with top-level `source_files`, `automation_index`, and stray `org` → **not** HTTP 422 from Pydantic extra. Allowed outcomes: **201** if GQS ≥ 90, or **400** with a GQS reasons list if GQS &lt; 90.  
   - Same Work Units as FIXED, plus those benign top-level keys, should still be able to pass GQS if the WUs themselves are clean.  
   - One Work Unit with a top-level `variant` field (not under `context`) → **422** (`WorkUnitImport` extra=forbid).

5. **Add a pre-commit hook** (or `scripts/check_no_pii.sh` invoked by a pytest if hooks are awkward in CI):
   - Fail if application code or new fixtures contain the sample employer name used in the original dirty JSON (treat as org hardcoding).
   - Fail if a new file matches a real-looking email *and* is not under an allow-list of obvious fakes (`example.com`, `invalid.`, `person_a@`).
   - Fail if a new file matches `\d{4}-\d{4}-\d{4}-\d{4}` that is not `XXXX-XXXX-XXXX-XXXX`.
   - Do not scan `alembic/versions` binaries. Do not fail on the word “UAN” itself.

6. Push branch + tag. **Stop.**

### D.2 Must not touch
`gqs.py` formula, `verdict.py`, `work_edges` structure, `regulatory_entries` structure, any new endpoint.

### D.3 Acceptance (Slice 0 Definition of Done)
- [ ] Tag `v0.7-foundation-corrected` exists on the pushed branch  
- [ ] `docs/HONESTY.md` present and matches Reference (no new invented validators)  
- [ ] `test_top_level_extra_forbid_regression.py` green  
- [ ] `pytest` still includes the original 28 and they pass on `docker-compose up -d postgres && alembic upgrade head`  
- [ ] GQS snapshots unchanged: SCRUBBED 40, FIXED 94.29  
- [ ] Operator asks for review and does **not** open Slice 1 until review returns

### D.4 Rollback
`git revert` the honesty-doc / test commit; delete the tag only if it pointed at a bad tree. Do not rewrite history after push.

---

## E. Slice 1 — Observed ingest, Track A only (sessions 2–4)

**Tag out:** `v0.7-ingest-track-a`  
**Why this is the leverage gap:** Scout cannot read a spreadsheet. Provenance hashes are caller-supplied, so “tamper-evident” is false. The 14-unit JSON is a hand-built fixture; the 5 raw CSVs were never parsed; “62 WUs / 87-step parse” remains an unverified planning number and must not appear in code, tests, or pitch.

**Three PRs, three sessions. No LLM client in any of them.**

### E.0 Shared contracts for Slice 1

**Auth:** same per-org `X-Spec-Key` as genome import. Missing/wrong → 401. RLS via `tenant_db()`.

**Existing tables only:**
- `UploadedFile` — writer added in 1a  
- `ReviewQueueItem` — writer added in 1b/1c  
- Do not create a second files table

**Confidence rule (published, do not invent another):**
| Match | Score |
|---|---|
| Exact header | 1.0 |
| Synonym dict hit | 0.8 |
| Levenshtein distance ≤ 2 | 0.6 |
| Else | 0.3 |

**Queue rule:** confidence **&lt; 0.7** → `ReviewQueueItem`, do not import that column/row mapping as if it were known. Distance-2 fuzzy scores 0.6 and therefore **queues**. That is intentional.

**Synonym seed for Step identity column** (extend only with tests):  
`Step #`, `Step No`, `Sl No`, `Activity`, `Task`, `S.No`, `No`

**Substring guardrail (Track A):** every deterministic mapped field value must be a substring of that row’s `raw_text` (case-fold allowed, whitespace-collapse allowed). If not → queue, do not coerce.

**GQS path:** Track A emits a `GenomeImportRequest` and calls the **existing** import orchestration. No second writer. No GQS weight changes.

### E.1 PR 1a — Upload + server sha256

**Must not touch:** parser intelligence, GQS, verdict, legacy routers.

**Endpoint**
```
POST /api/files/upload
Content-Type: multipart/form-data
Header: X-Spec-Key
Body: file (csv|xlsx)
```

**Behavior**
1. Reject empty, oversize (pick an explicit cap, document it, test it — e.g. 10 MiB — do not silently drop).
2. `hashlib.sha256` over the **raw bytes received**, hex lowercase 64 chars.
3. Insert `UploadedFile`: `id`, `client_id`, `file_name` (basename only), `sha256`, `size`, `uploaded_at`, `uploaded_by` if the key maps to an actor, else null.
4. Return `201 { file_id, sha256, size, file_name }`.
5. Do not parse in this PR.

**Provenance policy (additive, tested):**
- If import provenance includes `file_id`:
  - `file_id` must exist in `UploadedFile` for this client → else 400 with a reason, not a stub file row.
  - If `hash_sha256` is also supplied, it **must equal** `UploadedFile.sha256` → else 400.
- If no `file_id` is supplied, accept caller hash as today, write an audit warning `provenance.hash.not_computed`, and let GQS ProvenanceStructured% / violation detector flag it. Do **not** change GQS weights to invent a new penalty class in this PR if a violation code already covers unstructured/missing hash. If it does not, add a *named violation reason string* only, with a snapshot test, and do not retune weights.

**Tests (`tests/test_file_upload_sha256.py`)**
- Bytes fixture → response sha256 == `hashlib.sha256(bytes).hexdigest()`
- Same bytes, two tenants → two rows, isolated by RLS (client B cannot GET/list client A’s file if a GET exists; if no GET yet, prove via direct `wep_app` SELECT)
- Import citing unknown `file_id` → 400
- Import citing known `file_id` + wrong hash → 400
- Import citing known `file_id` + matching hash → not rejected for that reason
- No key → 401

**DoD 1a:** upload returns server hash; mismatch path is 400; 28/28 still green.

### E.2 PR 1b — Classifier + review queue

**Must not touch:** LLM client, GQS weights, verdict, CostProfile.

**Input:** an `UploadedFile` id.  
**Output:** a classification record (in-memory + persisted findings) and zero or more `ReviewQueueItem`s.

**Algorithm**
1. Load bytes for this client only.
2. Parse CSV via stdlib; XLSX via the already-available spreadsheet library in the repo (if none, add one dependency in this PR only, pinned).
3. Detect header row (first non-empty row unless a metadata block is detected above it).
4. Metadata block hints (non-fatal): Workflow Name, Outcome, Trigger, Frequency, SPOC — store as file-level notes, do not invent WUs from them.
5. For each header cell, score against the synonym dict + Levenshtein ≤ 2 rule above.
6. If the Step-identity column confidence &lt; 0.7 → one `ReviewQueueItem` for the file (`reason=unrecognized_step_column`, include raw header row) and **stop mapping**. Do not import.
7. Persist items with: `file_id`, `row`, `col` nullable, `confidence`, `reason`, `raw_text`, `client_id`, `created_at`.

**File-6-class fixture:** a sheet whose headers are unrelated (`Col A`, `Notes`, `Owner`) with no Step synonym within distance 2. Must queue, must not call import.

**Tests (`tests/test_classifier_review_queue.py`)**
- Header `Sl No` → confidence 0.8, no queue for that column
- Header `Step #` → 1.0
- Header `Stp No` (distance 2 from `Step No` or equivalent — encode the exact pair in the test so Levenshtein cannot drift) → 0.6 → queue
- File-6-class → queue, zero calls to import service (mock/spy)
- Classifier does not write Work Units

**DoD 1b:** File-6-class never becomes a genome. `Sl No` is recognized. No LLM import.

### E.3 PR 1c — Track A mapper + orphan visibility

**Must not touch:** GQS weights, verdict, LLM, CostProfile.

**Canonical micro-step (internal, not an HTTP schema to advertise as V8):**
```
step_id_raw, what_happens_raw, decision_branches_raw, system_raw,
step_type_raw, data_fields_raw, docs_policies_raw, automation_tag_raw,
time_per_case_raw, frequency_raw, volume_raw, agent_notes_raw,
file_id, row, hash_sha256, raw_text
```
`hash_sha256` = `UploadedFile.sha256` (server), never the caller’s guess.

**Track A mapping (deterministic columns only):**
| Micro-step | Work Unit field |
|---|---|
| step_id_raw | id (clipped to 40; if empty → queue row) |
| what_happens_raw | name (clipped to 200) |
| (column mapped to BO, else queue) | business_object |
| current/desired raw | current_condition / desired_condition, then existing 80-char clip + ellipsis |
| trigger raw | trigger (no verb validator — honesty doc still says not enforced) |
| cells containing `RR-` | regulatory_register_link[]; others ignored for RR |
| — | provenance `{source_type: observed, file_id, row, hash_sha256, notes}` |

Leave empty on purpose (do not LLM-fill): variants, acceptance, evidence, verification prose, failure semantics if no substring exists. Empty required lists will fail `WorkUnitImport` min_length=1 — that is correct. Either:
- the row goes to `review_queue` with `reason=track_a_incomplete`, or
- the batch goes to import and GQS/Pydantic returns 400 with reasons.

Prefer **queue the row** when a required Track A field is missing, so the operator sees a queue rather than a wall of GQS codes. Document the choice in the PR and test it.

**Substring guardrail:** mapped value ⊆ `raw_text`. Fail → `reason=ungrounded_mapping`.

**Orphan visibility (v0.7 addition, required):**
After Track A produces the in-memory WU list, for every `dependencies[]` entry that does not match an `id` in that same list:
1. Create `ReviewQueueItem` `type/reason=orphan_dependency` with `dependency_id`, `file_id`, `row`, `raw_text`.
2. Do **not** silently skip without a queue row.
3. Still do not create a Sequence edge to a missing target (existing write behavior).
4. Import of the batch still runs through GQS; orphans will keep score ≤ 80 if any remain. That is the gate. The queue is the *visibility* layer so a human can add the missing unit or drop the reference.

**Happy-path acceptance sample (do not claim 14 WUs from raw Excel on day one):**
A 3-row CSV constructed in tests, headers using `Sl No`, with three self-contained units, no orphans, required lists present as substrings of the row text, provenance complete → import **201** and GQS ≥ 90 **or** 400 + reasons if the tiny fixture cannot hit 90 because Observed%/kappa/completeness math needs more.  

If a 3-row fixture cannot legally reach 90 without faking kappa or Observed%:
- do **not** fake kappa,
- put `dual_scoring_kappa: 0.81` in the *test payload only* if the formula requires it, and comment “caller-supplied, not measured”,
- or accept 400 + reasons as the documented outcome of that fixture and add a second fixture that *does* clear 90 without lying about file hashes.

Never hardcode 94.29 as the expected score of a new CSV. Snapshot whatever the code returns, with a comment.

**Tests**
- `tests/test_parser_v2_minimum.py` — 3-row synonym path → mapper → existing import
- `tests/test_orphan_review_queue.py` — dependency `WU-DOES-NOT-EXIST` → `ReviewQueueItem` + no Sequence edge to it + GQS reasons include orphan if the batch is scored
- ungrounded mapping → queue, not import
- clip-80 still applied (ellipsis present when raw current_condition is long)

**DoD Slice 1:**
- [ ] Server sha256 on every upload  
- [ ] File-6-class → review_queue, not import  
- [ ] Synonym `Sl No` maps  
- [ ] Orphan → ReviewQueueItem, not silent skip  
- [ ] Existing FIXED JSON import still 201 / 94.29  
- [ ] Existing SCRUBBED still 400 / 40  
- [ ] No LLM client imported  
- [ ] Tag `v0.7-ingest-track-a`  
- [ ] Stop for review

---

## F. Slice 2 — Playback surface (sessions 5–7)

**Tag out:** `v0.7-playback-surface`  
**Why:** this is what a room sees. Import without disclosure is a database.

**Must not touch (all three PRs):** write-path mapping, GQS weights, verdict.py, RLS policy rewrite.

### F.1 PR 2a — Business objects L1 / L2 / L3

**Endpoints (names may be routed under `/api/genome/{version_id}/...` as long as tests pin them):**

**L1** `GET /api/genome/{version_id}/business-objects`  
```
{
  version_id,
  business_objects: [
    {
      name,
      work_unit_count,
      ratified: bool | "partial",
      state_machine: [],
      needs_state_machine: true
    }
  ]
}
```
`EntityType.state_machine` defaults to `"[]"` and import does not populate it. **Return `[]` and `needs_state_machine: true`.** Do not invent transitions.

**L2** `GET /api/genome/{version_id}/business-objects/{bo_name}/work-units`  
List: `id, name, current_condition, desired_condition, time_per_case_min` if present, autonomy if a verdict row exists else `null`, provenance `{file_id, row, hash_sha256}`.

**L3** `GET /api/genome/{version_id}/work-units/{wu_id}`  
Full 18 attrs. Reconstruct arrays from joined DB strings if needed. `context.variants[]` only — never a top-level `variant`. Include dependencies, RR strings, failure_semantics, evidence, acceptance.

**RLS:** Org B → 404 on all three, same as parent genome GET.

**Tests (`tests/test_business_objects_disclosure.py`)** on the FIXED 14-unit sample:
- L1 returns the distinct BO set from that fixture (assert the **set**, do not assert a marketing “6 BOs” unless the fixture actually groups to 6 — count from the fixture in the test setup and snapshot it)
- L2 only WUs for that BO
- L3 has 18 keys and `context.variants` is an array
- Org B 404

Do not write “L1 6 BOs / L2 5 Employee Record WUs” into production code. If the RESPONSE-TO-CLAUDE note used those numbers, they are fixture-derived guesses until the test prints the real group-by.

### F.2 PR 2b — Partial ratify + audit

**Extend** `POST /api/genome/{version_id}/ratify`

```
{
  "business_object": "string | null",
  "work_unit_ids": ["WU-..."] | null,
  "approved": true,
  "comment": "string"
}
```

| Body | Behavior |
|---|---|
| both null | existing whole-version ratify |
| `business_object` set | approve all WUs with that BO on this version |
| `work_unit_ids` set | approve those WUs only |
| both set | intersection (safer than union); test this |

Persist rows in a `ratifications` table **only if it already exists**. If it does not, add a migration in this PR that is additive (do not rebuild `genome_versions`). `GenomeVersion.ratified = true` only when every WU on the version has an approving row (or when whole-version path is used).

**AuditLog** events to add (import already logs attempt/committed):
- `genome.ratify.whole`
- `genome.ratify.business_object`
- `genome.ratify.work_units`
- `genome.read` — only if the volume is acceptable; if not, log L1/L3 reads and skip list endpoints. Document the choice.

Org B ratify → 404.

**Tests:** whole / BO / partial / intersection; audit row exists; Org B 404; version flag false until complete.

### F.3 PR 2c — Automation index + two detectors

**Endpoint:** `GET /api/genome/{version_id}/automation-index`

**Hours math (named constants, no magic numbers in callers):**
```
WORKING_DAYS_PER_MONTH = 22   # only for per-day bottleneck view
BUS_FACTOR_WU_THRESHOLD = 3   # published planning rule
BUS_FACTOR_HOURS_PER_DAY = 6  # published planning rule
```
Do not add a dollar constant.

```
hours_current_wu = time_per_case_min * volume_per_month / 60
```
Skip WUs missing either factor. **Do not impute.**

```
hours_saveable_wu = hours_current_wu
  only when verdict.autonomy in {L4, L5, L6}
```
If no verdict row: exclude from saveable; increment `verdict_missing_count`.

`cost_per_verified_unit` = `null`  
`needs_cost_profile` = `true`

`rule_debt_count` = count of WUs whose verification_method mapped via the **existing heuristic fallback** to `human_spot_check`. Do not invent a second debt definition.

**Autonomy counts:** from stored verdict rows only. Missing → 0 for that bucket, plus `verdict_missing_count`.

**highest_value_targets:** WU ids with saveable hours, sorted descending, omit if hours unknown.

**Bottleneck / Shared Resource:**
- Group by exact `authority` string.
- If count(WUs) &gt; `BUS_FACTOR_WU_THRESHOLD` **and**  
  `sum(time_per_case_min/60 * volume_per_month / WORKING_DAYS_PER_MONTH)` &gt; `BUS_FACTOR_HOURS_PER_DAY`:
  - `bus_factor_1 = true`
  - insert `work_edges` type `shared_resource` with  
    `reason="authority_overlap"`,  
    `detection_method="authority_overlap_v1"`
- Else `bus_factor_1 = false`. Provide a fixture that must not fire.

**Shared Object:**
- Same `business_object` on ≥ 2 WUs in the version → `work_edges` type `shared_object`  
  `reason="Same Business Object {bo} operated by multiple WUs"`  
  `detection_method="business_object_overlap_v1"`

**Reciprocal:** `reciprocal_edges: 0`, `reciprocal_computed: false`. Do not ship an empty list dressed as “no cycles.” Optional cheap DFS may be a later PR.

**Response shape (contract tests pin keys):**
```
{
  "L1_count": 0,
  "L2_count": 0,
  "L3_count": 0,
  "L4_count": 0,
  "L5_count": 0,
  "L6_count": 0,
  "verdict_missing_count": 0,
  "total_hours_current": 0.0,
  "total_hours_saveable": 0.0,
  "highest_value_targets": [],
  "cost_per_verified_unit": null,
  "needs_cost_profile": true,
  "rule_debt_count": 0,
  "bottleneck_view": [
    {
      "authority_redacted": "string",
      "wu_count": 0,
      "hours_per_day": 0.0,
      "bus_factor_1": false,
      "wu_ids": []
    }
  ],
  "work_graph_summary": {
    "sequence_edges": 0,
    "shared_object_edges": 0,
    "shared_resource_edges": 0,
    "reciprocal_edges": 0,
    "reciprocal_computed": false
  }
}
```
`authority_redacted` uses existing PII redaction. Never return a raw email or UAN.

**Tests (`tests/test_automation_index.py`)**
- Hours equal a hand-computed fixture with two WUs that have time+volume and one that lacks volume (omitted)
- `cost_per_verified_unit is None`
- bus-factor-1 true fixture and false fixture using the named constants
- Shared Object edges created once (idempotent on second GET — either create-on-import or create-on-read with uniqueness; pick one, test idempotency)
- FIXED JSON still imports at 94.29; Sequence count on that fixture remains 13 unless the PR documents why not

**DoD Slice 2:** L1–L3 + partial ratify audited + index with null cost + two detectors + Org B 404 + tag + stop.

---

## G. Slice 3 — Make G6 and DPDP sentences true (sessions 8–10)

**Tag out:** `v0.7-security-closed`  
**Why a separate slice:** every other router still depends on the global key. Bundling this with upload or regex tightening is how you take the demo down.

**Must not touch:** GQS formula, verdict.py, parser, production data.

### G.1 PR 3a — Retire global key + rotate

1. Inventory routers still reading `spec_api_key` / `dev-spec-key-change-me` (`work_units`, `spec`, `census`, any other).
2. Switch them to `TenantDbDep` + per-org `X-Spec-Key`.
3. Config: remove the runtime default `dev-spec-key-change-me`. Missing config → process must not boot with a hardcoded secret. Test this.
4. Temporary header `X-Deprecated-Global-Key: true` **only** if a compatibility window is required; default is **off**. Do not ship a week of silent dual-auth unless a caller inventory exists. Prefer break + fix callers in this same PR.
5. `POST /api/org/keys/rotate`
   - Requires a currently valid per-org key.
   - Hash at rest (existing scheme on `org_api_keys` / client key table — do not invent bcrypt-vs-sha if one already exists; **match the existing hasher**).
   - Previous key: `inactive`, `expires_at` set. Grace window is a named constant. After expiry, 401.
   - Response returns the new plaintext key **once**.
   - `AuditLog` `org.key.rotate`.

**Tests:** grep/config test that the default secret is not applied; rotate then old key 401 after grace; new key 200 on genome GET; genome GQS path untouched (FIXED still 94.29).

### G.2 PR 3b — HTTP RLS pytest (replaces the cleaned-up manual script)

`tests/test_rls_http.py` against docker-compose Postgres, no production data.

Matrix:
| Step | Expect |
|---|---|
| Create client A + B via API (per-org keys, no global key) | 201 |
| POST /api/genome/import as A (FIXED fixture) | 201 |
| GET genome as A | 200, 14 WUs |
| GET genome as B | 404 |
| GET L1/L2/L3 as B if Slice 2 merged | 404 |
| POST ratify as B | 404 |
| no header | 401 |
| wrong key | 401 |
| upload as A, list/select as B | 0 rows / 404 |

This test is the Gate 15 regression. CI must run it.

### G.3 PR 3c — Consent write + 90-day purge

`POST /api/consent/receipts`
```
{
  "interview_id": "uuid | string",
  "interviewee_initials": "P.A.",
  "consent_type": "transcript | notes_only",
  "granted_at": "iso",
  "expires_at": "iso",
  "purpose": "string"
}
```
Store on existing `ConsentReceipt`: `client_id` from the key, initials as given (already scrubbed by caller; reject if value matches an email regex).

**Provenance rule (document in HONESTY.md):**
- `source_type=observed` **from an interview** requires `consent_receipt_id` that exists for this client. Else 400.
- `source_type=observed` **from an operational file export** (upload path) may have `consent_receipt_id=null` with `file_id` set. This is not a loophole for transcripts — `consent_type` files are not created by upload.

**Purge job:** `POST /api/admin/purge` or a module invoked by cron, running as `SystemSessionLocal` only.
- Until a `transcripts` table has rows, the job still runs and reports `{deleted: 0}`.
- When transcripts exist: delete or tombstone where `auto_purge_at < now()`, audit `consent.purge`.
- 90 days is the published constant `CONSENT_TTL_DAYS = 90`. Do not invent 30/180.

**Tests:** receipt create; observed-interview import without receipt → 400; file-observed without receipt → allowed; purge endpoint with system session returns 0 on empty; non-system role → 401/403.

**DoD Slice 3:** no runtime default global key · rotate works · `test_rls_http.py` in CI · consent write + documented observed rule · purge path exists · tag `v0.7-security-closed` · stop.

---

## H. After the loop — parked work (not this operating cycle)

Open only after `v0.7-security-closed` *and* a real spreadsheet has cleared GQS ≥ 90 or produced a review_queue a human can resolve.

| Item | Guardrail |
|---|---|
| Track B LLM | Every generated span ⊆ `raw_text` or reject to queue. No free-form. |
| F1 Split | Split on &gt;1 BO or &gt;1 authority or &gt;1 verification method or &gt;1 independently verifiable acceptance. Persist `split_reason`. Do not KPI “11→16.” |
| Dedup | key = hash(BO + desired + variant key). Variants merge into `context.variants[]`. Cross-file exact dup → one WU, provenance array. |
| Pack SDK | 5 files + `scout pack validate`. First pack from current HR sample ontology. No company name in pack. Finance pack is the reuse proof, not the first deliverable. |
| `GET /diff` | Needs version type on `GenomeVersion` first (v1 Inferred / v2 Detailed / v3 Ratified). Semantic sentences, no field dumps. |
| 50-file corpus | Start 8–12 including File-6-class. 50 is hardening, not a vanity metric. |
| Demo video | Film the live loop only. Do not animate Founder/SME capture that does not exist. |

Tag when the room loop is filmable: `v0.8-demo-ready-minimum` (Slices 0–2) then `v0.8-demo-ready` (Slice 3 included).

---

## I. Quality gate for every PR (print this in the PR template)

```
[ ] Did not touch verdict.py or gqs.py weights
[ ] Did not widen VARCHAR(80)
[ ] Did not add orgs / regulatory_register / work_graph_edges tables
[ ] Did not invent a 5th gate, $ rate, or 62-WU claim
[ ] No real PII / no employer name in code
[ ] New tests named and listed
[ ] Full pytest green including original 28
[ ] GQS SCRUBBED=40 FIXED=94.29 unless snapshot reason is in the PR body
[ ] alembic check clean if migration added
[ ] HONESTY.md updated if a validator changed from specified → enforced
[ ] RLS: new GET/POST is tenant-scoped or explicitly SystemSessionLocal
[ ] Room-language: no new claim that this PR does not demonstrate
```

---

## J. Room operating script (only after the tagged slice that adds the step)

| Step | Allowed when | Say | Do not say |
|---|---|---|---|
| Refuse dirty | Slice 0+ (JSON) or Slice 1 (file) | “Quality gate blocked this at GQS 40 with 62 detected issues on the scrubbed slice.” | “All 15 gates failed.” |
| Accept clean | Slice 0+ | “Quality gate passed at GQS 94.29.” | “15 gates passed.” “62 WUs parsed.” |
| Upload | Slice 1 | “Hash was computed on the server; it is in UploadedFile.” | “Every hash we have ever stored was server-side.” (false for old JSON) |
| Queue | Slice 1 | “Confidence below 0.7 went to review, including orphans.” | “The parser always produces a genome.” |
| BO walk | Slice 2 | “Ratify the object, then the unit.” | “State machines are closed-loop.” (`[]` + flag) |
| Index | Slice 2 | “Hours from rows that have time and volume. Cost is null until a rate exists.” | Any dollar save. |
| Isolation | Slice 0 manual / Slice 3 automated | “Tenant B cannot see this version — 404.” | “Every endpoint in the product is on per-org keys.” (false until 3a) |
| Consent | Slice 3 | “Interview Observed requires a receipt. Purge job runs at 90 days.” | “DPDP aligned” before 3c. |
| Pack flywheel | parked | — | Do not say it. |

---

## K. Failure modes already paid for (do not regress)

| Bug | Symptom | Permanent guard |
|---|---|---|
| 1 Superuser bypass | Client B read client A | App role is `wep_app`, never bootstrap superuser |
| 2 Bootstrap vs RLS | `bootstrap_tenants` saw 0 rows | `SystemSessionLocal` only on maintenance path |
| 3 Top-level forbid | Benign metadata 422 | `test_top_level_extra_forbid_regression.py` |
| 4 SET LOCAL | RLS vanished after mid-request commit | Session-scoped SET in `tenant_db()` |
| VARCHAR clip | HR prose truncated hard | Mapping-layer ellipsis; no ALTER widen |
| Doc inflation | Validators described that were never built | `docs/HONESTY.md` + this playbook §B |

If a new bug is found, add a row here in the same PR that fixes it.

---

## L. Metrics Scout may compute vs must not

**May compute from data present on the version:**
- GQS and its six published components  
- Observed% / completeness% as GQS already defines them  
- WU count = `len(work_units)` at read time (never store `total_work_units`)  
- Sequence / shared_object / shared_resource edge counts  
- Hours current / saveable where sla fields exist  
- Review-queue size, classifier confidence histogram  
- RLS denials (401/404 counts) if logged  

**Must not compute or display:**
- Dollar savings  
- “62 WUs from 87 steps”  
- Kappa unless two human scores exist  
- Closed-loop state-machine completeness (machines are `[]`)  
- “15/15 gates”  
- Bus-factor using any thresholds other than &gt;3 WUs and &gt;6 hrs/day  

---

## M. First operator move (right now)

This workspace does not contain the application repository — only the corrected docs and plans. Slice 0 cannot be committed from here.

**On the machine that has the repo:**
1. Re-read corrected State / Reference / Vision.  
2. Execute Slice 0 (§D) only.  
3. Paste the tag SHA and the `pytest` tail.  
4. Do not start Slice 1 until that review happens.

If Slice 0 reveals that `docs/` does not exist, create it in that PR. If the pre-commit hook cannot run in CI, ship the same checks as `tests/test_no_pii_or_org_hardcode.py` and say so in the PR body — the guard matters more than the hook mechanism.

---

## N. One-line operating summary

Operate Scout as a **gated importer that is becoming a discovery engine**: freeze verdict and GQS, tell the truth in `HONESTY.md`, put files and hashes on disk before any LLM, show objects before dollars, close the global key only after the room surface works, and never let an unresolved dependency disappear without a review-queue row.

**Branch:** `feat/genome-import-foundation`  
**Next tag:** `v0.7-foundation-corrected`  
**Locked scores:** GQS 40 vs 94.29 · tests 28/28
