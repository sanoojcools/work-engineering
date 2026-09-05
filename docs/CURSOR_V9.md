# Cursor brief — build V9 on V8

Repo: `sanoojcools/work-engineering`
Branch: `idea/v9` (already created from `main`)
You are Cursor. Build V9 **in this repo**. Lift existing code. Do not start a new app.

Walkthrough minute this work serves: the Offer Desk demo the founder can give without shame.

---

## 0. Read before typing

1. `docs/ideas/v9.md` — the idea
2. `docs/HONESTY.md` — what is already enforced in V8
3. `docs/STATUS.md` — what V8 already is
4. Existing Offer Desk: `frontend/src/pages/OfferDesk.tsx`, `frontend/src/lib/offerDeskData.ts`
5. Persist / GQS: `backend/app/services/gqs.py`, genome import, Scout generate
6. Scout three layers: already in models + `ScoutInterview.tsx`
7. Blast radius: already in `BlastRadius.tsx` + backend service

Static reference of the V9 walk (look, do not copy as a second product):
https://github.com/sanoojcools/work-engineering-v9/tree/main/ui/prototype

---

## 1. What you are building

Change the **default journey** of the existing React + FastAPI app so a stranger can do this:

Home → Enterprise → HR → HR operations → Offer Desk → three interviews → Playback → Spreadsheet → Save talk-only (empty, denied) → How we cut it → Gap → Document-check Work Unit → Hours 95 stated / 61.8 defended → Spec deny without a pass.

On every one of those screens show four panes:

**Given | How we understand it | What the platform does | Output you can see**

Everyday words first. Formal name in brackets. i-button from the existing `InfoTooltip` / `glossary.ts`.

---

## 2. What you must reuse (do not rewrite)

| Need | Already here |
|---|---|
| Work Unit contract | `backend/app/models/workunit.py` |
| GQS persist gate | `backend/app/services/gqs.py` + genome import |
| Scout sessions + 3 layers | scout models, `ScoutInterview.tsx` |
| Blast radius | `scout_blast_radius` + `BlastRadius.tsx` |
| Offer Desk facts | `offerDeskData.ts` |
| VERDICT | `services/verdict.py` |
| Spec deny | `services/spec.py` + Spec page |
| RLS / org keys | leave alone |
| Demo bootstrap | keep working |

If a function exists, call it. Do not paste a new persist if/else unless you are wrapping the existing gate.

---

## 3. Work order (do in this order, commit after each)

### Slice A — Door + HR map (UI only)

After “Set up the demo”, first screen is two doors: Enterprise / SME.
SME is a disabled card: “Not built. Same honesty rules.”
Enterprise shows HR live, Finance / Legal / Operations listed.
HR shows CHRO map. **HR operations** is the live card. Talent acquisition stays on the map, not the live wedge.
HR operations opens Offer Desk (reuse `OfferDesk.tsx`).

Done when: founder never lands on invoice-dispute Overview as the first story.

### Slice B — Three seats + playback

Wire Offer Desk to three Scout sessions (Function Head, Sub-function Lead, SME).
CHRO and Head of HR Ops may stay labelled **stand-in** until a real sitting exists.
Rashmi session uses the real Offer Desk rows already in `offerDeskData.ts`.
Add a Playback page: three columns, do not merge disagreements.
Four-pane IO on each of these pages.

Done when: you can click Rashmi and see step 2 (document check, 15–40 min) from the sheet language.

### Slice C — Persist honesty (backend + UI)

“Save talk-only” must call the **existing** generate / GQS path.
Talk-only (interviews, no sheet treated as traces) → persist denied, inventory count 0.
Do not waive GQS. Do not invent observed provenance.
Sheet attach = declared ingest. Label every field declared. `accepted` for ratification stays false until traces exist.

Done when: a test fails if talk-only persist returns success with saved_count > 0.
Add `backend/tests/test_v9_offer_desk_persist.py`.

### Slice D — Work record + hours + spec

Open document check as one Work Unit (before: unchecked, after: accepted or blocked).
Helper may draft missing-doc list. Helper may not release an offer.
Dual employment = stop. Appetite does not lift it.
Hours strip: 95 declared from sheet, 61.8 defended. Both visible.
Spec page: request without pass → denied. Use existing Spec service.

Done when: founder can read the Work Unit to Rashmi and she recognises Tuesday.

### Slice E — Words

Update `frontend/src/lib/glossary.ts`:

- Talk-only picture (G-SCOUT)
- Interview completeness (Genome Strength)
- Evidence strength (GQS)
- Save (persist)
- Work record (Work Unit)
- Hours we will defend (S1)
- Rules for a helper (Spec API)
- How far a helper may go (VERDICT)

No screen title is only G-SCOUT or G-DOC.

---

## 4. Contracts you must not break

```
POST persist or generate from talk-only
→ denied
→ saved_count = 0
→ reasons include completeness_is_not_clearance or existing GQS block

Sheet / declared ingest
→ provenance declared on every new field
→ zero Zwayam events claimed
→ ratification accepted = false

Dual employment
→ stop
→ helper cannot release offer letter
```

---

## 5. Refuse

- New FastAPI app in a new folder that replaces `backend/`
- New React app that replaces `frontend/`
- Postgres schema rewrite
- Fake Zwayam traces
- Filling inventory so the demo looks “complete”
- Finance / Legal live catalogs
- Job runner / executing Offer Desk
- Copying the static prototype as the product and deleting V8 pages

---

## 6. How to run

```
git fetch
git switch idea/v9
docker compose up --build
```

UI: http://localhost:5173
API: http://localhost:8000

Tests:

```
cd backend
pytest tests/test_v9_offer_desk_persist.py tests/test_gqs.py -q
```

---

## 7. PR rules

One PR per slice (A then B then C then D then E).
Each PR body:

- Walkthrough minute served
- V8 file reused (path)
- Gate still unliftable?
- Test that would have failed before this PR

Base branch for PRs: `idea/v9` first. Merge to `main` only when the founder has given the walk once and said it is clean.

---

## 8. Definition of done for V9 on this branch

A stranger, after Set up the demo, can finish the Offer Desk path in 12 minutes.
Talk-only save stays empty.
95 and 61.8 both show.
No G-SCOUT as a page title.
V8 Overview / Genome / VERDICT pages still exist in the nav for later, not as the opening story.
