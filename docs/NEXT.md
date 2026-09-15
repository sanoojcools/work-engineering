# NEXT — agents read this and execute their section

Discovery program is unlocked. V10-1…14 are on main. Do not rebuild Chart, Plan 95/61.8, or Gap buckets.

**Cloud factory: LOCKED.** GitHub Actions must not spend Claude credits.
**Local Sonnet paste: this file’s Claude section is the work order.**

Canon: `docs/WEP_Discovery_Proposal.md` v2. Roadmap: `docs/DISCOVERY_ROADMAP.md`.

---

## Claude

**UNLOCKED for local paste only.**

Execute `docs/contracts/d1-chro-sitting.md` **Backend section only**.

- Persist CHRO sitting answers on the existing `function_head` session (`timeline_json.sitting_answers` preferred; no new table unless HONESTY says why).
- `PUT`/`GET /api/scout/sessions/{id}/sitting-answers`
- `POST /api/work-systems/{id}/draft-strategy-intent` — focus must be a literal substring of an answer; 422 if already confirmed.
- `packs/hr/hard_anchors.yaml` + `GET /api/packs/hr/hard-anchors` (dual_employment from existing Document-check copy).
- Tests against real Postgres. HONESTY.md paragraph.
- Branch `claude/d1-sitting`. Ready PR → main. **Do not merge. Stop.**

No frontend. No Chart. No Plan. No CensusPlan.tsx. No scrape. No scout-v1 import. Do not start D-2 or D-3.

Ignore any leftover V10-10 lock in git history. Founder instruction + this file win.

---

## Cursor

**LOCKED until D-1 BACKEND is on `main`.**

When `GET /api/scout/sessions/1/sitting-answers` exists on main (not 404), execute `docs/contracts/d1-chro-sitting.md` **Frontend section only**. Branch `cursor/d1-chro-ui`. Ready PR → main. Do not merge. Do not start D-2.

If that GET is not on this main: reply **BLOCKED — waiting on Claude D-1**. No feature PR.
