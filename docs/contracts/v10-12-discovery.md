# V10-12 contract — discovery as performer + four counters (backend only)

Claude implements **this file**. No extra product. No frontend.

Canon: extraction is a **performer**, not a silent author. Binding fields never become “seen in records” from a model. On write we count four delinquencies: **invention, omission, distortion, flattery**. Golden set = Offer Desk seed. Not 12 counters. V10_CLOSE.md “V10-12 · DISCOVERY AS PERFORMER + DELINQ”. Canon 2.3 + Part 11.

---

## Already on `main` (reuse)

| Already there | Role |
|---|---|
| `POST /api/scout/extract-from-story` | transcript → chunks. `used_llm` already honest. |
| `services/scout_story.py` | LLM or deterministic fallback. Span must be a substring today — keep that. |
| Binding fields (pointers) | `authority`, `acceptance_criteria`, `actor_constraints` — declared quote only. |
| `PUT /api/verdict/{id}` | real score. Do not invent a second engine. |
| Dual-employment stop | unliftable. |
| `llm_provider=none` | supported. Tests must pass **without** a live key. |

---

## 1. Extract is a performer

Extend `StoryExtractOut` (same route, no second extract URL):

```
used_llm: bool
chunks: [...existing...]
note: str
cap: "execute_with_approval"   # always this string for extracted binding fields
counters: { invention: int, omission: int, distortion: int, flattery: int }
golden: false                  # true only on the golden-set runner below
```

Rules, **deterministic**, no extra model call:

1. **Invention** — a chunk's `span` (or equivalent text) is not a case-insensitive substring of the transcript → +1 invention. Drop that chunk from `chunks` (do not return invented work).
2. **Distortion** — a structured field on the chunk is non-empty and is not a substring of that chunk's span → +1 distortion. Blank the field; keep the chunk.
3. **Flattery** — transcript contains `dual employment` (case-insensitive) **and** no returned chunk span contains `dual employment` → +1 flattery. Do not invent a stop row; just count.
4. **Omission** — **only** when running the golden set (section 3). Not on live extract (we do not have a hidden expected list for a stranger's notes).

Binding fields in a chunk (`authority`, `acceptance_criteria`, `actor_constraints` if present) **must not** be labelled observed/declared. If you persist any pointer from extract, status is `predicted`. Cap remains `execute_with_approval`. Do not auto-PUT VERDICT to a live-agent level.

Live extract still does **not** write `work_units` (today's contract). Counters are returned on the response **and** added to this tenant's running totals (section 2) only when `used_llm` is true **or** the caller posts `commit: true`. Default `commit: false` so looking does not pollute totals. Add optional `commit: bool = false` on `StoryExtractIn`.

Without a key: 401. Guest UI will never call this.

---

## 2. Tenant totals

`GET /api/scout/delinquency` (keyed):

```
{ invention: int, omission: int, distortion: int, flattery: int }
```

Zeros for a new tenant. RLS: tenant B never sees tenant A's counts.

Store how you like (columns on `clients`, or a 1-row-per-client table with RLS). No 12-counter table. No Palantir.

`commit: true` on extract **adds** this call's counters to the tenant totals (never subtracts).

---

## 3. Golden set (Offer Desk seed)

`packs/hr/golden_extract.yaml`:

- `transcript`: short Rashmi-shaped notes that **must** include the words `dual employment` and at least one named step that is a substring (e.g. `verify candidate documents`).
- `must_span`: list of strings that a non-inventing extract should keep (substring match).
- `forbidden_span`: at least one invented phrase that must **not** appear if someone pastes it into chunks.

`python -m pytest backend/tests/test_v10_12_discovery.py`:

1. Transcript + an invented span in a **stubbed** chunk list → invention +1, invented chunk dropped.
2. Field value not in span → distortion +1, field blanked.
3. Transcript has `dual employment`, returned spans do not → flattery +1.
4. Golden runner: load the yaml, run extract with `llm_provider` effectively off (deterministic path). `omission` = count of `must_span` items not found in returned spans. Fixture asserts omission is a number ≥ 0 (honest), not a fake 0 if the deterministic path returns nothing — if used_llm is false and chunks empty, omission = len(must_span), totals still honest.
5. `commit: false` does not bump GET delinquency. `commit: true` does. Tenant B isolated.
6. Binding field from extract cannot be written as `declared` / `observed` pointer (422 or ignored — pick one, test it, HONESTY names it).
7. Dual-employment stop on WU-OD-02 handoff still unliftable.
8. Full suite green **without** `LLM_API_KEY`.

---

## Refuse

Frontend · Chart 18-leaf · Plan 95/61.8 · Gap UI · Sit close · 12 counters · live Anthropic in CI · auto-release of offers · Darwinbox/Zwayam · login · V10-13 · flipping Gate 9 import to reject · rewriting Rashmi sheet rows

`docs/HONESTY.md` paragraph. Branch `claude/v10-12`. Ready PR → `main`. **Do not merge.** Stop.
