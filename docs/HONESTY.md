# Scout Import Path — Honesty Matrix

Enforced today vs specified-but-not-enforced, for `POST /api/genome/import`'s `WorkUnitImport` schema. Source: `Scout-Reference.md` (corrected 2026-08-26). Do not add a row claiming a validator that has no matching test.

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
| sla_timing | structured, all fields optional, extra=forbid; only `time_per_case_min` mapped to `sla_hours` | `gt=0` on time; other fields read back |
| dependencies | `list[str]`, default []; unresolved = skip edge | schema/FK reject |
| failure_semantics | min 1 | — |
| regulatory_register_link | `list[str]`; upsert stub on `regulatory_entries.regulation` | `RR-` prefix; must-exist FK |
| provenance | extra=forbid; only `source_type` pattern-validated `^(observed\|declared\|inferred\|designed)$` | `hash_sha256` `^[a-f0-9]{64}$`; server-computed hash; `file_name`; consent existence |

Also true, not a per-attribute row:

- Container `GenomeImportRequest` is `extra="ignore"` — benign top-level metadata (`source_files`, `automation_index`, a stray `org`) does not 422; GQS scores it instead.
- GQS runs on the raw dict, before Pydantic validation.
- `dual_scoring_kappa` is caller-supplied. No mechanism produces two independent scores to compute it from.
- No file writer exists yet for `UploadedFile` — no endpoint uploads a file, so `hash_sha256` in provenance today is whatever the caller supplied, never server-computed.
- Legacy routers (`work_units`, `spec`, `census`) still authenticate via the single global `spec_api_key`, default `dev-spec-key-change-me`. Only the genome router uses per-org `X-Spec-Key`.
- 15 No-Cracks Gates: #15 (RLS) is fully live. ~6 are partially live. ~8 are specified-only. GQS ≥ 90 means the quality gate passed — it does not mean 15/15 gates passed.

Update this file in the same PR any time a row moves from "specified" to "enforced."
