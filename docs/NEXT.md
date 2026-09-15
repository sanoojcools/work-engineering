# NEXT — agents read this and execute their section

Discovery program is unlocked. D-1 BACKEND is on `main` (#59). Do not rebuild Chart, Plan 95/61.8, or Gap buckets.

**Cloud factory: LOCKED.** GitHub Actions must not spend Claude credits.
**Local paste: this file’s section is the work order.**

Canon: `docs/WEP_Discovery_Proposal.md` v2. Roadmap: `docs/DISCOVERY_ROADMAP.md`.

---

## Claude

**LOCKED.** D-1 backend shipped (#59). Do not start D-2/D-3 until Cursor D-1 UI is on main. If you are a cloud run: stop. No feature PR.

---

## Cursor

**UNLOCKED.**

Execute `docs/contracts/d1-chro-sitting.md` **Frontend section only**.

D-1 API is on this main: `GET`/`PUT /api/scout/sessions/{id}/sitting-answers`, `POST /api/work-systems/{id}/draft-strategy-intent`, `GET /api/packs/hr/hard-anchors`.

Branch `cursor/d1-chro-ui` off latest `main`.

Replace `OfferDeskFunctionLeader` stand-in with pain-to-permit, one question at a time.
Keyed: PUT sitting-answers; use as this period’s line → POST draft-strategy-intent.
Immediately after successful POST, render returned `strategy_intent.label` on THIS page as **This period (draft)** with Edit and Confirm. Do not hide it.
Edit → POST draft-strategy-intent again (substring or 422 on screen).
Confirm → existing `POST /work-systems/{id}/confirm-strategy-intent`. No second confirm API.
Guest: type only, no `we-spec-key`; still show This period (draft) from what they typed; Confirm disabled.
Do not ask offer steps. Do not invent 47 days. Do not touch Playback, Chart 18, Plan 95/61.8.

Playwright: guest 1→6; Plan still 95 and 61.8; pain question visible; This period (draft) after typing; no key minted.
Ready PR → main. Do not merge. Stop. Do not start D-2.
