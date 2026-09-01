# Scout Reference Architecture (corrected)
Date: 2026-08-26 | Branch: feat/genome-import-foundation | Tests: 28/28 | Source-of-Truth Hierarchy: V8 > verdict.py > Master Plan + patches > 5 Excels sample only

**Superseded in several respects, well after this was written — this file is a dated snapshot, not rewritten in place.** Stages 1–3's "no capture mechanism built" claim, and most of the 15 No-Cracks Gates table below, describe 26 August 2026. Since then: Scout's interview capture (stages 1–3) is real; the file-upload path (stage 4) is built; and, most recently (enterprise-readiness roadmap Track 3), gate 8 (DFS cycle detection) and gate 3/14's consent join are both closed for the live Scout path. Current count: 5 of 15 gates live, 2 more substantially built, 8 still not built — see `docs/Work-Engineering-V8.md` Part K10 for the full re-audited table and `docs/HONESTY.md` for the evidence behind each row.

**Correction note (this revision):** the prior version described several validations (regex patterns on `id`/`hash_sha256`/`trigger`, an FK-must-exist check on regulatory links, a specific `orgs` table schema) as implemented. They are not. Corrected below, and each 18-attr entry now says explicitly whether its rule is enforced in code today or only specified for Parser v2 to build.

## Source-of-Truth Hierarchy
1. Work-Engineering-V8-Detailed-FULL.md
2. `services/verdict.py` — 4 gates: compliance=1 cap L2, reversibility=1 cap L3, impact=1 cap L3, no evidence path cap L2 — KEEP as truth
3. Master Build Plan v0.4 + Critical Evaluation + AMBITIOUS v0.6 + CONTINUE v0.6.1
4. 5 HR Excels — sample only, no hardcoding

Rules: no org hardcoding, no real PII, no invented thresholds, no extra fields on a Work Unit, provenance structured, versioning v1/v2/v3 + semantic diff (diff engine specified, not built).

## 7-Stage Flow — Spec Status

This flow is the target design from the planning docs. **None of stages 1–3 (Founder interview, Function Leader interview, SME interview + consent) have any capture mechanism built.** Stage 4 (bulk ingest) has no file upload path. Stage 5's "Scout Engine" pipeline exists only as: GQS calculation → Pydantic validation → DB write; there is no format classifier, no Two-Track mapping, no F1 split, no dedup engine. Stage 6 (playbacks) has a `POST /ratify` endpoint only — no `GET /business-objects` progressive-disclosure views, no BO-level partial approval. Stage 7 (WEP handoff) works for the JSON-body path that exists: `POST /api/genome/import` → `GET /api/genome/{id}` → `X-Spec-Key` enforcement (for the genome router only, not the rest of the API).

1. Founder Why — **not built**.
2. Function Leader Inferred v1 Playback — **not built** (no question bank, no interview capture).
3. SME Detailed v2 — **not built** (no transcript capture, no consent-receipt creation flow even though the `consent_receipts` table exists).
4. Bulk Ingest — **not built**. No file upload endpoint exists anywhere in the app; import is JSON-body only.
5. Scout Engine — **partially built**: GQS + Pydantic validation + DB write exist and are proven (40 vs 94.29). Format classifier, canonical micro-step schema, Two-Track mapping, F1 Split, Dedup — **none built**.
6. Playback 1/2 + Ratification — **partially built**: `POST /{version_id}/ratify` exists and works (whole-version approval only, not BO-level partial approval as specified). No playback UI or `GET /business-objects` API.
7. WEP Handoff — **built for the JSON-body path**: `POST /api/genome/import`, `GET /api/genome/{version_id}`, `GET /api/genome/{version_id}/gqs`, `POST /api/genome/{version_id}/ratify`, all behind per-org `X-Spec-Key` auth. Proven via real HTTP with RLS enforced (Org A 200, Org B 404).

## 18 Attributes — Contract as Actually Implemented

Per V8 E3. Each entry below states the *actual* Pydantic/DB behavior, not the aspirational spec.

1. **id**: `str`, `min_length=1, max_length=40`. **No regex pattern enforced** (a pattern like `^WU-[A-Z]+-[0-9]+$` is specified in planning docs but not implemented).
2. **name**: `str`, `min_length=1, max_length=200`. Free text — no verb-noun format check.
3. **business_object**: `str`, `min_length=1`. Auto-creates an `EntityType` row by this name if one doesn't exist (not restricted to a fixed ontology list — Function Pack ontology enforcement is not built).
4. **current_condition**: `str`, `min_length=1`. **Clipped to 80 chars (with an ellipsis) at write time** if the source text is longer — the DB column is `VARCHAR(80)` and was not widened.
5. **desired_condition**: same as above — clipped to 80 chars, not widened.
6. **context**: structured `{decision_branches: str, variants: list[str]}`, `extra="forbid"`. Stored as a JSON string in the existing `context` text column (no new column added).
7. **trigger**: `str`, `min_length=1`. **No verb-content validation** — a trigger string with no verb would currently pass.
8. **input**: `list[str]`, `min_length=1`. Joined with `"; "` into the existing `inputs` text column at write time (the DB still stores a string, not an array — the array-ness is enforced only at the API boundary).
9. **authority**: `str`, `min_length=1`. Scanned for PII (email/phone/UAN patterns) before storage; any hit is encrypted via pgcrypto separately and a redacted preview stored.
10. **actor_constraints**: `str`, `min_length=1`. Same PII scan as authority.
11. **acceptance_criteria**: `list[str]`, `min_length=1`. Joined to a text column at write time, same as `input`.
12. **evidence_required**: `list[str]`, `min_length=1`. Joined to a text column; also PII-scanned.
13. **verification_method**: `str`, `min_length=1` (free text on the wire). Mapped to the existing `VerificationMethod` enum via a keyword heuristic (`"cross-system"` → `cross_system_reconciliation`, etc.) with `human_spot_check` as the default fallback when nothing matches — **not a strict enum on input**, a best-effort text-to-enum mapping.
14. **sla_timing**: `{time_per_case_min: float|None, frequency: str|None, volume_per_month: int|None, sla_deadline: str|None, raw: str|None}`, `extra="forbid"`. **All fields optional** (no `gt=0` constraint as previously described) — `raw` is a deliberate fallback for SLA text that hasn't been parsed. Only `time_per_case_min` is currently used (converted to `sla_hours`); the rest are stored but not read back anywhere yet.
15. **dependencies**: `list[str]` of other Work Unit IDs, default `[]`. **Not FK-enforced at the schema level.** An entry that doesn't resolve to a unit in the same import is silently skipped (no edge created) rather than rejected. The practical guarantee against orphans comes from GQS scoring (see below), not from this field's validation.
16. **failure_semantics**: `str`, `min_length=1`. Free text.
17. **regulatory_register_link**: `list[str]`, default `[]`. **No "RR-" prefix pattern enforced.** Matched against the pre-existing `regulatory_entries.regulation` column; if no match, a stub `RegulatoryEntry` is auto-created with that string — an upsert, not a "must already exist" FK check.
18. **provenance**: `{source_type: str (pattern "^(observed|declared|inferred|designed)$"), file_id: str|None, row: int|None, col: str|None, hash_sha256: str|None, timestamp: str|None, interview_id: str|None, consent_receipt_id: str|None, notes: str}`, `extra="forbid"`. **`source_type` is the only pattern-validated field.** No `file_name` field exists. `hash_sha256` has no format check and, since no file upload endpoint exists, is never computed by Scout itself — any value here is whatever the caller supplied.

**Top-level container (`GenomeImportRequest`) is `extra="ignore"`, not forbid.** It accepts `function_pack`, `work_units` (required), `work_graph_edges` (optional, currently unused by the import logic beyond `work_units`-derived Sequence edges), and `dual_scoring_kappa` (optional). Any other top-level field — `org`, `total_work_units`, `source_files`, `automation_index` — passes through Pydantic without error; those are exactly the fields the GQS violation detector checks for separately.

## F1 Split Rule, Dedup — Status

**Not implemented.** No code inspects an incoming Work Unit for multiple Business Objects / Authorities / verification methods and splits it. No dedup key computation, no cross-file merge logic. The FIXED sample fixture used in testing was already pre-split (14 discrete units) by hand, not by any Scout code.

## VERDICT 7 Dims + L1–L6 + 4 Hard Gates — Source of Truth: `services/verdict.py`

Per V8 Annexure C (1/3/5 published, 2/4 interpolation, no numeric mean→level formula published by V8 — the existing code's own docstring says this honestly, and that framing is preserved, not changed):

| Property | 1 | 3 | 5 |
|---|---|---|---|
| Verifiability | No independent check possible | Human spot check possible | Deterministic rule or DB state check |
| Evidence | No trail | Partial logs | Complete, tamper-evident trail |
| Reversibility | Irreversible external effect | Reversible with cost/effort | Fully reversible / idempotent |
| Determinism | Unstructured, open-ended | Semi-structured | Structured, deterministic |
| Impact Scope | Enterprise-wide / regulatory | Department / segment | Single object, contained |
| Compliance | Requires licensed human | Requires approval, auditable | No special authority |
| Tacitness | Pure judgment, unwritten | Mix explicit + tacit | Fully explicit procedure |

Autonomy levels (V8 Annexure D + `services/verdict.py`): L1 Human Only, L2 Assisted, L3 Collaborative, L4 Supervised, L5 Fully Automated, L6 Fully Deterministic (no LLM in execution).

**4 H2 hard gates — exactly these, no 5th:**
- Gate 1: compliance=1 → cap L2
- Gate 2: reversibility=1 → cap L3
- Gate 3: impact=1 → cap L3
- Gate 4: no evidence path (verifiability=1) → cap L2

`CLAUDE-CODE-BUILD-READY-V0-5.md`'s version of this table had wrong caps (L1/L2 instead of L2/L3) and an invented 5th gate — that table is superseded, `services/verdict.py` is the source of truth.

**Dual-scoring kappa**: the import service accepts an optional `dual_scoring_kappa` float and factors it into the GQS formula (10 points if `>0.8`). **There is no mechanism that produces two independent scores to compute kappa from** — the caller supplies the number directly. This is a real gap: kappa is scored, not measured.

## Work Graph — 4 Edge Types per Thompson, Implementation Status

The 4 types (Sequence, Shared Object, Shared Resource, Reciprocal) are defined in the pre-existing `EdgeType` enum on the pre-existing `work_edges` table (not a new `work_graph_edges` table). Sequence is auto-derived on import, only from the `dependencies` list on each imported Work Unit — not from a Handoff Map or trigger-text analysis. **Slice 2 PR 2c** adds two more auto-derived types, both computed (and persisted, idempotently) on `GET /api/genome/{version_id}/automation-index`, not on import: Shared Object (same `business_object` on ≥2 WUs) and Shared Resource / bus-factor-1 (same exact `authority` string on more than 3 WUs whose combined `time_per_case_min × volume_per_month` load exceeds 6 hrs/day over a 22-day month — both named constants, not invented). `work_edges.reason` / `detection_method` record why each of those two types fired; Sequence edges leave both blank. Reciprocal (including cycle detection) remains **specified, not implemented** — the endpoint reports `reciprocal_edges: 0, reciprocal_computed: false` rather than a fake empty list.

## GQS — Genome Quality Score + 15 No-Cracks Gates

**Introduced in the planning docs (Master Plan v0.4), not part of V8 itself** — this framing is preserved from the original doc and is accurate.

```
GQS = Observed% * 0.4 + Completeness% * 0.2 + ZeroOrphan*10 + ZeroViolations*10 + Kappa*10 + ProvenanceStructured%*0.1
```

Implemented exactly as written in `app/services/gqs.py`, operating on the **raw dict** before Pydantic validation (so a failing genome still gets a score and a reasons list, not a bare rejection). Proven: SCRUBBED sample = 40 (blocked), FIXED sample = 94.29 (passes), both from running code, 4 tests lock this in.

**15 No-Cracks Gates — actual status, not aspirational:**

| # | Gate | Status |
|---|---|---|
| 1 | Founder why captured | **Not built** — no capture mechanism, no `orgs` table (tenant boundary is `clients`) |
| 2 | Question bank 100% mapped to 18 attrs | **Not built** — no Function Pack SDK, no `question_bank.yaml` |
| 3 | ≥2 SME transcripts with consent receipt | **Not built** — no transcript capture, `consent_receipts` table unused |
| 4 | Bulk attachments parsed with Observed provenance + sha256 | **Not built** — no file upload path |
| 5 | 18 attrs non-null, Pydantic validation passes | **Partially live** — `WorkUnitImport` validates its own 18 fields; the container is permissive (see above) |
| 6 | F1 Split Rule applied, reason logged | **Not built** |
| 7 | VERDICT derived from 7 dims, gates logged, kappa>0.8 | **Partially live** — `verdict.py` derivation is real and used when a `verdict` block is supplied; kappa is caller-supplied, not measured |
| 8 | Work Graph no orphan WU, DFS cycle detection | **Partially live** — orphans are excluded by GQS arithmetic (see above); no DFS cycle detection exists |
| 9 | BO state machines closed loop with terminal state | **Not built** — `entity_types.state_machine` defaults to `"[]"` and is never populated by import |
| 10 | Conformance gaps flagged Declared vs Observed, P0/P1/P2 severity | **Not built** — the pre-existing `conformance_gaps` table is unrelated to the import path |
| 11 | Playback 1 before Playback 2 (v1 before v2) | **Not built** — no version-type gating logic |
| 12 | Ratification by manager, BO-level + partial WU | **Partially live** — `POST /ratify` exists but is whole-version, not BO-level or partial |
| 13 | JSON schema validation, no extra fields, FKs exist | **Partially live** — see the corrected per-attribute list above; several "FK exists" claims are actually auto-create-on-miss, not enforcement |
| 14 | PII classification + consent receipt + encryption + redaction | **Partially live** — PII scan/encrypt/redact is real and proven; consent-receipt creation is not built |
| 15 | RLS tenant isolation, 2 orgs cannot read each other | **Live and proven** — Org A 200 / Org B 404 via real HTTP; automated regression test not yet written |

**Net: 1 of 15 gates is fully live (15), ~6 are partially live, ~8 are specified only.** The GQS formula's own 6 components cover much of the same ground as several of these gates, which is why a genome can score >90 without all 15 individually being wired as separate blocking checks.

## Interface Contract — ScoutAPI → WEP

The target JSON shape below is the design intent from the planning docs. **The actual `GET /api/genome/{version_id}` response today is simpler**: `{version_id, gqs, ratified, work_unit_count, work_units: [...]}` using the existing `WorkUnitOut` schema (DB-column shaped: `inputs` as a joined string, not an array; no `work_graph_edges`, `automation_index`, `gqs` breakdown, or `version_history` in the response). The richer contract below remains the target for `GET /diff`, which does not exist yet. `GET /api/genome/{version_id}/automation-index` **does** exist now (Slice 2 PR 2c) — see `docs/STATUS.md` / `SCOUT_OPERATING_PLAYBOOK.md` F.3 for its actual (narrower) response shape: hours current/saveable from present `sla_timing` fields only, `cost_per_verified_unit: null` (no `CostProfile` data is ever populated by import), autonomy counts from stored VERDICT rows, and the two edge detectors above.

```
{
  function_pack: string,
  version: string,
  org_id: UUID,                     // target design — actual tenant key is clients.id (int), not a UUID column
  work_units: [ {18 attrs, verdict, context.variants[]} ],
  work_graph_edges: [{from, to, type, reason, detection_method}],
  automation_index: {...},          // GET /automation-index exists now (Slice 2 PR 2c) but returns a narrower, flatter shape than this — see above
  gqs: {...},                       // GET /gqs returns a subset of this today
  version_history: [...],           // not built
  files: [...]                      // not built — no file table populated
}
```

## Function Pack SDK — 5 Files + CLI

**Entirely not built.** No `pack.json`, `business_objects.yaml`, `question_bank.yaml`, `regulatory_stubs.yaml`, `parser_hints.yaml`, `verdict_anchors.yaml`, or `scout pack validate` CLI exist anywhere in the repo. This whole section remains target design for a future session.
