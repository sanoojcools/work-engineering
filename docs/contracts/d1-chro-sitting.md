# D-1 — CHRO sitting (pain-to-permit → draft this-period line)

Read `docs/DISCOVERY_ROADMAP.md` and `docs/WEP_Discovery_Proposal.md` §0.6 and §4 CHRO sitting.

## Why

`OfferDeskFunctionLeader.tsx` is a labelled stand-in (`CHRO_STAND_IN`). Strategy line is **seeded** at work-system ensure: “This quarter: cut offer-to-Day-1 cycle time, not headcount.” Confirm-strategy-intent does **not** change `strategy_intent_focus` (V10-9 honesty). Discovery is empty above Rashmi.

## Backend (Claude) — ship first

No new table if `timeline_json` can hold it. Prefer `ScoutInterviewSession.timeline_json.sitting_answers` (object). Do not smash existing `blocks` / `gaps`.

### Answers

`GET` / `PUT /api/scout/sessions/{id}/sitting-answers`

- Keyed. Session must be `type=function_head` (404/422 otherwise).
- Body: `{ "answers": [ { "id": string, "text": string } ] }`
- `id` allowed: `pain` | `so_what` | `this_period` | `in_out` | `who_binds` | `anchor:<key>`
- PUT **replaces** the sitting_answers object for that session (idempotent). Empty `text` allowed (they skipped).
- GET returns `{ "answers": [ … ] }` in the same shape. Missing key → `[]`, not fixtures.
- Guest never hits this (no key). 401 without key.
- RLS: other tenant 404.

Do not write Work Units from these answers. Do not call extract-from-story. Do not invent ids beyond the list.

### Draft strategy from a quote

`POST /api/work-systems/{id}/draft-strategy-intent`

Body: `{ "focus": string, "source_session_id": int }`  
`focus` min length 8.

Rules:

1. 422 if `strategy_intent_confirmed_at` is set (confirmed line is frozen; they use Correct later, not this).
2. 422 if session `source_session_id` is missing, other tenant, or not `function_head`.
3. 422 unless `focus` is a **literal substring** of at least one sitting-answer `text` on that session (same honesty as field-ratify quotes).
4. Sets `strategy_intent_focus = focus`. Does **not** set confirmed_at / confirmed_by.
5. Does not invent numbers. Store their string as-is.
6. AuditLog the write.
7. Existing ensure seed stays for tenants that never call this.
8. Response is the existing `WorkSystemOut` (so the UI can render `strategy_intent.label` immediately).

### Hard anchors (pack, not LLM)

Add `packs/hr/hard_anchors.yaml`.

- At least one entry whose key is `dual_employment`.
- `label` / `prompt` copied from text **already in this repo** (Document check stop rule / Offer Desk sheet), not a new scare library.
- `GET /api/packs/hr/hard-anchors` — can be unauthenticated read of the pack file (no tenant data). Returns the YAML as JSON. No DB.

`scout pack validate packs/hr` still passes (anchors are extra; do not break 18-attribute coverage).

### Tests (real Postgres)

- PUT answers on function_head persists; GET round-trips.
- PUT on sme session → 422.
- Cross-tenant GET/PUT 404.
- draft-strategy 422 if focus not in answers.
- draft-strategy 422 if already confirmed.
- draft-strategy happy path: focus substring stored; confirmed_at still null; response includes that focus as `strategy_intent.label`.
- GET hard-anchors includes `dual_employment` and a string that exists in repo source (test: substring of Document check stop copy or offer-desk sheet text already committed).
- Full suite green. alembic check: **no new table** unless you prove timeline_json cannot hold this — if you add a table, say why in HONESTY.md.

### Refuse

Frontend. Chart. Plan. CensusPlan.tsx. Scraper. Confidence float. Scout-v1 import. V10-11+. Merging.

Ready PR → main. Do not merge. Stop.

---

## Frontend (Cursor) — only after the API is on `main`

Branch `cursor/d1-chro-ui` off that main.

Replace stand-in theatre on `OfferDeskFunctionLeader.tsx`:

1. One question at a time. Order: `pain` → `so_what` → `this_period` (draft line = their last answer, editable) → `in_out` → `who_binds` → pack anchors as checkboxes from GET hard-anchors.
2. Pain copy (verbatim): *Think of the last hire that went off the rails between offer and Day-1. What broke?*
3. So-what: *Who owns that? May a helper change it without a named human?*
4. Do **not** ask s1 / offer steps / Excel vs Zwayam.
5. Keyed: PUT sitting-answers as they go. “Use as this period’s line” → POST draft-strategy-intent with focus = selected sentence (must be substring).
6. **3-minute loop (do not hide):** Immediately after a successful POST, render the returned `strategy_intent.label` **on this same page**, below the input, as **This period (draft)** — i-button: strategy intent. Controls: **Edit** and **Confirm**. Do not send them to Plan to see the line.
   - Edit: they change the sentence; POST draft-strategy-intent again (still must be a substring of an answer; 422 stays on screen, no invented paraphrase).
   - Confirm: existing `POST /work-systems/{id}/confirm-strategy-intent` with a name. Do not invent a second confirm API. After confirm, the line reads confirmed (same status the Plan row already uses). Plan still owns 95 / 61.8; this page does not show those numbers.
7. Guest: type in the walk; answers stay in memory; **never** PUT/POST; never mint `we-spec-key`; banner looking-only. Still show **This period (draft)** from what they typed on this page (walk-only). Confirm disabled.
8. Empty stand-in card (`CHRO_STAND_IN` workbook quotes) **removed** from this page once the sitting UI exists. Label: start sitting, not “stand-in.”
9. FacilitatorStrip may stay; it must not be the only prompt.
10. Customer words. Canon (strategy intent, function_head) in i-buttons.
11. IoPanes: given = what they typed; output = draft line or “none yet.”

Do not touch Playback (D-2), Chart 18, Plan 95/61.8, Sit close, backend tables.

Playwright: guest 1→6; Plan still 95 and 61.8; Function leader shows the pain question; after guest types, **This period (draft)** is visible on that page; `we-spec-key` stays null; no invented “47 days.” Keyed path: after POST, the returned focus is visible on Function leader (CI).

Ready PR → main. Do not merge. Stop. Do not start D-2.
