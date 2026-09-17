# NEXT — agents read this and execute their section

D-1 both halves are on `main` (#59 API, #60 UI). Do not rebuild Chart, Plan 95/61.8, or Gap buckets.

**Cloud factory: LOCKED.** GitHub Actions must not spend Claude credits.
**Local paste: this file’s section is the work order.**

Canon: `docs/WEP_Discovery_Proposal.md` v2. Roadmap: `docs/DISCOVERY_ROADMAP.md`.

Founder accepted keyed CI 500s on the shared demo tenant when landing #60. Do not spend this slice chasing those 500s. Come back after D-2: writes must return 409/422, not 500.

---

## Claude

**UNLOCKED — D-3 only.** Local paste. If you are a cloud run: stop.

Port extract **rules** into this repo (one `?`, no automation-framing, span must be a literal substring, fail closed, no silent mock). Not a scout-v1 / aodp import.

Branch `claude/d3-extract-guardrails` off latest `main`.

Files: `backend/app/services/scout_story.py`, tests next to `test_v10_12_discovery.py` / `test_scout_story_llm.py`, one honest paragraph in `docs/HONESTY.md`. Same extract URL. Tests never call a live model. Do not touch frontend, Chart, Plan, or `handoff.py`.

Ready PR → main. Do not merge. Stop. Do not start D-4/D-5.

---

## Cursor

**UNLOCKED — D-2 only.**

Playback from **stored answers**, not `PLAYBACK_ROWS`, once any real text exists. Empty stays empty. Confirm/Correct = existing sit-close shape.

Branch `cursor/d2-playback` off latest `main` (`1f5a151` or later).

Files: `frontend/src/pages/OfferDeskPlayback.tsx`, Playwright only for Playback checks. Do not edit Function leader, Chart, Plan math, or backend.

Guest: no `we-spec-key`. Census still 1 of 6 … 6 of 6. Plan still 95 and 61.8 as two numbers.

Ready PR → main. Do not merge. Stop. Do not start Ops seat or SME dump.
