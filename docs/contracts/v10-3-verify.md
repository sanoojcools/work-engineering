# V10-3 contract — verify / certify / 5th gate

Claude implements **this file**. No extra product.

## Tables (RLS, same tenant pattern as `work_systems`)

`verification_designs` 1:1 with `work_units.id`
- `method` text — one of: `document_check` | `system_of_record` | `second_person` | `sample` | `reconcile` | `model_plus_human` | `none`
- `independent` text — `different_lineage` | `deterministic` | `no` | `not_stated`
- `sampling` text nullable — or `not_stated`
- `cost_of_check` text nullable — or `not_stated` (no invented money)
- `dual_track` bool — true = do may be delegated, **check stays human**. Never starts an agent.

`certifications` 1:1 with `work_units.id` — **separate table from provenance / field_pointers**
- `class` text — `sure` | `mostly_sure` | `reported_not_seen` | `cannot_define`
- Rule: `class=sure` **rejected** if any binding field pointer status is `predicted` or `composed` (422).

## 5th gate

Reuse VERDICT hard gates. Add `intent_guardrail` (non-waivable when Work System intent is **confirmed**). Existing error-cost gate labelled in API as `contestable_default`. Dual-employment constraint: **still cannot be waived** at any scenario (already product law).

## Handoff

Extend existing `GET /spec/handoff/{code}`:
- `ready=false` if `method=none` OR (`independent` is `no`/`not_stated` AND control needs independence — **offer-release** and **dual-employment** units always need independence ≠ `no`).
- Do not execute work.

## HTTP

- `PUT /api/work-units/{id}/verification-design` (keyed)
- `PUT /api/work-units/{id}/certification` (keyed)
- GET the same, include on existing unit payload if cheap, else separate GETs.
- Guest: 401, no fake ready.

## Tests (must exist)

1. Offer-release unit, `independent=no` → handoff not ready  
2. `certification.class=sure` + predicted pointer → 422  
3. Dual-employment stop still true after ambitious scenario header  
4. RLS: tenant A cannot write tenant B design  
5. 401 without key  

## Must not

Frontend, Chart, Plan, CensusEvidence, Darwinbox, V10-4, inventing check costs, lifting the stop.
