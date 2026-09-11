# V10-14 contract — handoff bundle + invariants CI (backend + CI only)

Claude implements **this file**. No extra product. **No frontend pages.**

Canon: the pack a performer may receive is **record + actor policy + gates + validator spec + scenario + provenance**. **Withhold scores** from the performer view. Lint that blocks merge: binding fields need quotes; composed cannot flow unratified; careful ≤ as-calculated ≤ ambitious ≤ cap. V10_CLOSE.md “V10-14 · HANDOFF SCHEMA + INVARIANTS CI”. Canon [7] + [9].

---

## Already on `main` (reuse)

| Already there | Role |
|---|---|
| `GET /api/spec/handoff/{code}` | Ready / not-ready. 422 on admissibility. Dual-employment unliftable. |
| `HandoffOut.bundle` | Today = `WorkUnitOut` when ready, else null. **Extend, do not replace.** |
| Pointers + field ratify | Quotes on binding fields; confirm/correct. |
| `services/verdict.py` | Real scores. Do not invent a second engine. |
| `.github/workflows/ci.yml` | backend job already runs pytest. Add **one named step** for invariants. |

---

## 1. Two views on the same route

`GET /api/spec/handoff/{code}?view=governor|performer`

Default **`governor`** (today’s callers keep working).

Keyed. 401 without key. Admissibility 422 **unchanged**. Dual-employment stop **unliftable**.

When `ready` is false: `bundle` stays null (today). Reasons stay. No fake pack.

When `ready` is true, `bundle` becomes:

```
{
  "record": { ...WorkUnitOut without verdict scores... },
  "actor_policy": { "cap": "execute_with_approval" | existing allocation string, "owner": str },
  "gates": [ "gate4_evidence", "intent_guardrail", ... ],  // same list as today
  "validator_spec": { "method": str, "independent": "yes"|"no"|"not_stated" },
  "scenario": { "careful": int|null, "as_calculated": int|null, "ambitious": int|null, "cap": int|null },
  "provenance": { "source": str, "composed": bool }
}
```

**`view=performer`** — **withhold scores**:

- `scenario` values are all `null` (keys may remain so the shape is stable).
- `record` must **not** contain `recommended_level`, raw VERDICT properties, or S1/S2/S3 numbers.
- `actor_policy.cap` may stay (that is a **limit**, not a score).
- `gates` may stay (names of gates that fired, not points).

**`view=governor`** — scenario integers filled from the **existing** VERDICT row + the same floor/derived/ceiling rule Document check already uses (port the arithmetic into `services/` if it only lives in TS today — one Python function, tested, no second engine). If not scored: all scenario ints `null`, still `ready` only if today’s rule allows.

Keep today’s top-level `HandoffOut` fields (`ready`, `reasons`, `verification_method`, `gates`, `dual_employment_stop_required`, `independent_check_required`). Adding `view` is additive. Existing tests that read `bundle` as a work-unit-shaped object **must be updated** to `bundle.record` — that is this slice, not a surprise.

Unknown `view` → 422.

---

## 2. Invariants (red check blocks merge)

`backend/app/services/invariants.py` — pure functions + pytest.

CI: in `.github/workflows/ci.yml` **backend** job, after pack validate (or after tests — either is fine if it **fails the job**):

```
- name: Handoff invariants (V10-14)
  working-directory: ${{ github.workspace }}
  run: python -m pytest backend/tests/test_v10_14_invariants.py -q
```

(If those tests already run in `pytest -q`, the named step may be `python -c "from app.services.invariants import assert_repo_invariants; assert_repo_invariants()"` as a **second** explicit gate. One of the two must be a **named** step containing `invariants` so a red X is readable.)

### Lint 1 — binding fields need quotes

For `authority`, `acceptance_criteria`, `actor_constraints`: if the field is non-blank on a work unit **in a fixture/pack used as ready-to-hand-off**, a field pointer must exist with `quote` a literal substring and status `declared` (or `quote_verified=True`). A blank field is fine. A non-blank field with no quote → **fail**.

Test: unit with authority="Head of HR Ops may release" and no pointer → invariant raises. Same unit with a verified declared pointer → pass.

### Lint 2 — composed cannot flow unratified

If any pointer on the unit has status `composed` (or equivalent composed badge) and there is **no** confirmed field_ratification for that field → **fail**.

Test: composed pointer, no confirmation → raise. After confirm → pass.

### Lint 3 — careful ≤ as-calculated ≤ ambitious ≤ cap

Given seven property scores + applied gates, compute the three scenario levels with the **same** function the governor bundle uses. Assert `s1 <= s2 <= s3 <= cap` (cap = post-gate ceiling; if a hard gate caps all three at L2, then 1≤2≤2≤2 is pass). A synthetic triple 3,2,5 → fail. Dual-employment does **not** participate in this inequality (it is a stop, not a level).

---

## Tests (`backend/tests/test_v10_14_handoff.py` + invariants file)

1. 401 without key.
2. Default view is governor; performer withholds scenario ints (all null) and has no recommended_level on `bundle.record`.
3. Not-ready → bundle null on both views.
4. Dual-employment WU-OD-02 without stop language still not ready / unliftable.
5. Unknown view 422.
6. The three invariant unit tests above.
7. Existing handoff tests green after `bundle.record` migration.
8. Full suite green. No live LLM. No Chart/Plan/Gap edits.

---

## Refuse

Frontend pages · Chart 18-leaf rewrite · Plan 95/61.8 · Sit close · Box 4/5 execution · Darwinbox/Zwayam · login · lifting dual employment · a 19th leaf · leaking scores on performer view · a second VERDICT engine

`docs/HONESTY.md` paragraph. Branch `claude/v10-14`. Ready PR → `main`. **Do not merge.** Stop.
