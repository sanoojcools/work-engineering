# Intent contract — Box 2 → 3a field freeze

Slice `TIGHT-WEDGE`, T5. This freezes which `IntentSource` (Box 2, "downward"
intent — D1 in `Work-Engineering-V8.md`) fields feed which `ConformanceGap`
(3a, the conformance gap — D3) fields, using the mechanism that already
ships today. It does not add a table, a column, an endpoint, or an engine.
Per `docs/BUILD_PROGRAM.md` row 2-E, the Box 2 intent **engine** is later
work, gated on this freeze existing and a COO owning it — this file is the
freeze, not the engine.

## The models, as they exist today

`backend/app/models/discovery.py`:

- `IntentSource` — `id`, `kind` (policy / sop / okr / regulation /
  job_description / contract), `title`, `body`, `provenance`, `client_id`.
- `ConformanceGap` — `id`, `kind`, `severity`, `description`,
  `discovered_ref`, `declared_ref`, `work_unit_id`, `client_id`.

Both are real, migrated tables with live HTTP surfaces
(`GET/POST /discovery/intent`, `GET/POST /discovery/gaps`) — nothing here
is proposed schema.

## The one real path from Box 2 into 3a today

`services/discovery.py::scan_gaps` (`POST /discovery/gaps/scan`) is the only
code that ever reads an `IntentSource` row to produce a `ConformanceGap`.
For every intent row in scope, it calls `_intent_matches_unit(intent,
units)`:

```python
hay = _norm(f"{intent.title} {intent.body}")
# a match exists if any Work Unit's name, code, owner, or the first 20
# chars of its acceptance_criteria appears inside that combined text
```

On no match it writes:

```python
ConformanceGap(
    kind=GapKind.unimplemented,
    description=f"Declared intent '{intent.title}' has no matching Work Unit on object, owner, or acceptance.",
    declared_ref=intent.title,
    discovered_ref="",
)
```

**Frozen from this:**

| `IntentSource` field | Consumed as | Frozen shape |
|---|---|---|
| `title` | Matched against, and written verbatim into `ConformanceGap.declared_ref` | Plain title string. **Never an id, a code, or a new prefix** — see "refused" below |
| `body` | Matched against (concatenated with `title` before matching) | Free text, no further structure assumed |
| `client_id` | Scopes which units a given intent is compared against | Must equal the `ConformanceGap.client_id` it produces; `scan_gaps(client_id=None)` is the existing cross-tenant admin path, unchanged |
| `kind` | **Not read** by `_intent_matches_unit` today | Stored, inert for this comparison. Do not assume `kind` filters or labels anything on the gap it produces — it doesn't, yet |
| `provenance` | **Not read** by `scan_gaps` | Stored, inert for this comparison |

`declared_ref = intent.title` is the entire identifier contract this file
freezes: any future code that creates a `ConformanceGap` citing an
`IntentSource` must keep using the title as-is. It must not switch to the
row's integer `id`, and it must not mint a human-facing code format for
intent the way Work Units have `WU-xxx` — that would be a second numbering
scheme, which is exactly what "no INT-007 tables" refuses (below).

## What this means for the Offer Desk walk, named precisely

`frontend/src/pages/OfferDeskGap.tsx` — the screen this whole slice tightens
— filters real gaps to exactly three `GapKind` values: `undeclared`,
`split_recommended`, `missing_terminal_state`. All three are written only by
`services/genome_import.py`'s Gates 10, 6, and 9, and every `declared_ref`
they write is a Work Unit code or a business-object name — **none of the
three ever cites an `IntentSource` row.** `scan_gaps`'s `unimplemented` kind
— the only kind that ever cites intent — is deliberately excluded from that
screen already (see the `GATE_KINDS` comment in that file); it is a
different, older, generic discovery mechanism (census/SOP comparison), not
this sitting's.

So, stated plainly: **Box 2 has a real, working path into 3a today
(`scan_gaps`), and zero path into the Offer Desk walk's own Gap screen.**
The CHRO and HR Ops "stand-in" quotes on this walk
(`frontend/src/lib/offerDeskSeats.ts`'s `CHRO_STAND_IN` / `HR_OPS_STAND_IN`)
and the Gap page's own guest rows (`frontend/src/lib/offerDeskWorkRecord.ts`'s
`GAP_ROWS`) are hardcoded frontend constants. Nothing on this walk calls
`POST /discovery/intent`. They are not `IntentSource` rows today, and this
freeze does not make them into any — it only pins down what would happen to
one if it existed.

## What a future PR must do, and must not invent, if it wires this up

If a later slice adds a "save this stand-in answer as intent" action:

- It reuses `POST /discovery/intent` (`schemas/discovery.py::IntentCreate`)
  exactly as it exists — `kind`, `title`, `body`, `provenance`, `client_id`.
  No new intent-creation endpoint.
- The resulting gap, if any, still reaches `ConformanceGap.declared_ref` as
  `intent.title`, per the frozen mapping above — not a new field, not a new
  format.
- If the Offer Desk Gap screen is ever asked to show intent-sourced gaps, it
  consumes them by adding `unimplemented` to its existing `GATE_KINDS`
  filter and giving it an everyday-language label (the same pattern the
  other three kinds already use) — not a new comparison engine sitting
  beside `scan_gaps`.

## Refused, explicitly (do not build these under this freeze)

- **No INT-007, or any other, new identifier or table for intent records.**
  `IntentSource.id` (a plain integer primary key) is the only identity this
  freeze recognizes. A human-facing code format for intent is the Box 2
  intent **engine** (`BUILD_PROGRAM.md` row 2-E) — later, founder-reviewed
  work, not this freeze.
- **No auto-creation of `ConformanceGap` rows from intent text beyond what
  `scan_gaps` already does.** Extending or replacing that matching
  heuristic (`_intent_matches_unit`) is out of scope here.
- **No change to `_intent_matches_unit`, `scan_gaps`, or any migration,
  column, or endpoint.** This file is documentation of the existing
  contract, not a code change.
