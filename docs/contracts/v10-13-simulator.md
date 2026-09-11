# V10-13 contract — case simulator (backend only)

Claude implements **this file**. No extra product. No frontend.

Canon: one Offer → Day-1 case. All **18 leaves**. Careful / as-calculated / ambitious. Which leaves fire, where a human must touch, where Spec **blocks**. Capacity labelled **not live**. Not Box 6 (workforce simulator). Not Box 4 (execution). V10_CLOSE.md “V10-13 · CASE SIMULATOR”. Canon 3.6.

---

## Already on `main` (reuse)

| Already there | Role |
|---|---|
| `packs/hr/hire_leaves.yaml` | **The** 18 leaves. Read this file. Do not add a 19th. |
| `frontend/src/lib/offerDeskScenarios.ts` | S1 floor / S2 derived / S3 ceiling on a real VERDICT. Backend must not invent a second arithmetic — if a leaf has a real `VerdictScore`, reuse `services/verdict.py`. |
| Dual-employment stop | `WU-HIRE-05` / document-check stop. **Unliftable.** S3 does not lift it. |
| Spec handoff 422 | Admissibility + stop. Simulator **reports** the block; it does not run the desk. |
| Plan 95 / 61.8 | Offer Desk totals. Do **not** print 61.8 on a leaf. |

---

## Endpoint

`GET /api/simulations/offer-day1?scenario=careful|as_calculated|ambitious`

Aliases accepted (map, do not expose as the only names): `s1`→careful, `s2`→as_calculated, `s3`→ambitious. Default `as_calculated`.

Keyed. Guest UI will not call this (401 without key is correct).

Response:

```
{
  "work_system": "offer-day1",
  "composite": "The hire is complete",
  "scenario": "careful" | "as_calculated" | "ambitious",
  "leaf_count": 18,
  "leaves": [
    {
      "id": "WU-HIRE-01",
      "name": "...",          // from yaml, not invented
      "band": "external" | "automate" | "augment" | "human",
      "fires": "yes" | "no" | "outside" | "human_must_touch" | "blocked",
      "blocked_reason": null | "dual_employment" | "spec_deny",
      "expected": "...band from yaml...",
      "actual": "not_scored" | "yes" | "blocked" | ...,
      "stop": false            // true only for the yaml `stop: dual_employment` leaf
    }
    // exactly 18, yaml order
  ],
  "human_must_touch": [ "WU-HIRE-05", "WU-HIRE-18" ],  // ids where band=human or fires=human_must_touch
  "spec_blocks": [ { "id": "WU-HIRE-05", "reason": "dual_employment" } ],
  "capacity": {
    "labelled": "not_live",
    "stated_hours_mo": 95,
    "defended_hours_mo": 61.8,
    "if_we_ran_this": "how many people/agents if we ran this — not live",
    "peak_fte_stated": 95/160   // float, one decimal ok; 160 = one person-month of hours. Do not invent a second number.
  }
}
```

### Fires (deterministic, no LLM)

Read `hire_leaves.yaml` once. For each leaf:

1. `band == external` → `fires=outside`. Never “yes” (this desk does not run Zwayam/vendor).
2. yaml `stop: dual_employment` → `fires=blocked`, `blocked_reason=dual_employment`, `stop=true`. **All three scenarios.** Ambitious does not lift it.
3. `band == human` (and not already blocked) → `fires=human_must_touch`.
4. Else → `fires=yes` for as_calculated and ambitious; careful additionally treats `band == augment` as `human_must_touch` (floor: a human still in the loop). Automate stays `yes` even on careful.

`expected` = yaml band. `actual`:

- If this tenant has a **real** work unit whose code is this leaf id **or** the known Offer Desk twin (`WU-HIRE-05` ↔ `WU-OD-02` only — do not invent other twins): if Spec handoff would 422 / not-ready for dual-employment → `actual=blocked`; if a `VerdictScore` exists → `actual=yes` or the fires value; else `actual=not_scored`.
- Every other leaf: `actual=not_scored` unless a work unit with that exact `WU-HIRE-xx` code exists. **Do not** fabricate 18 scored units.

`spec_blocks` lists leaves with `fires=blocked`. Always includes WU-HIRE-05.

`leaf_count` must be 18. 19 is a bug.

Unknown `scenario` → 422.

---

## Tests (`backend/tests/test_v10_13_simulator.py`)

1. 401 without key.
2. Default scenario is as_calculated; `leaf_count==18`; ids match yaml order; no 19th.
3. WU-HIRE-05 is `blocked` / `dual_employment` on **careful, as_calculated, and ambitious**.
4. WU-HIRE-01 (external) is `outside` on all three.
5. Careful: an augment leaf (e.g. WU-HIRE-03) is `human_must_touch`; as_calculated: that leaf is `yes`.
6. `capacity.labelled == "not_live"`; `stated_hours_mo==95`; `defended_hours_mo==61.8`; `peak_fte_stated` is 95/160 (assert almost-equal); copy mentions “not live”.
7. Fresh tenant: 17 leaves `actual=not_scored` (HIRE-05 may still be blocked as **expected** fires, actual still not_scored if no WU-OD-02). Do not require import.
8. Dual-employment stop on real WU-OD-02 handoff still unliftable (existing test may already cover — pin it or call handoff).
9. Full suite green. No live LLM. No new Chart/Plan files.

---

## Refuse

Frontend · Chart 18-leaf rewrite · Plan 95/61.8 change · Gap UI · Sit close · Box 6 (headcount optimiser, org-wide sim) · Box 4 (agents executing) · Darwinbox/Zwayam · login · V10-14 · printing 61.8 on a leaf · lifting dual employment on ambitious · inventing 18 scored units · a 19th leaf

No new graph table required. Reading the yaml + existing verdict/handoff is enough. If you add a table, RLS it; prefer none.

`docs/HONESTY.md` paragraph. Branch `claude/v10-13`. Ready PR → `main`. **Do not merge.** Stop.
