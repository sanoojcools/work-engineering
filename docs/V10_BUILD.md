# V10 build — 80% of platform canon

**This file is the work order.** `V10_CLOSE.md` is the why. `BUILD_PROGRAM.md` is what is UNLOCKED this week.

Audience: **CHRO + VC**. Journey: **offer → Day-1**. One repo: `sanoojcools/work-engineering` `main`.
Host/Render: **out of scope until 30 Sep** (founder). Do not spend slices on backup or plan upgrades.

Target: **~80% platform canon** (execution of live work excluded — canon puts it outside). Two phases, 14 fat PRs.

| | Now | End Phase A | End Phase B |
|---|---|---|---|
| Walk | ~70% | ~90% | ~95% |
| MVP screens | ~40% | ~80% | ~90% |
| Canon | ~20% | ~45% | **~80%** |

---

## Seats

| Seat | Owns | Never |
|---|---|---|
| **Claude Code** | Postgres, RLS, Alembic, FastAPI, Spec/handoff, gates, tests, PR+CI merge | Chart visual design, customer-copy sweep, simulator UI |
| **Cursor** | Census/Chart/Gap/Plan UI, plain-language copy, Playwright walk, markdown export | New tables, new invariants, login vendor |
| **Grok** | Unlock next slice, reject theatre, prompts, % | App PRs |
| **Founder** | Walk hosted, Clerk when V10-7, Render after 30 Sep | Driving two agents on the same file |

**Collision rule:** one slice UNLOCKED for Claude and one for Cursor, **different directories**. If both need `CensusPlan.tsx`, Cursor waits.

**Git:** `git pull origin main` every session. New branch `claude/v10-N` / `cursor/v10-N`. PR → `main`. Squash when CI green. Do not force-push `main`.

---

## Refuse (all slices)

Live execution · Darwinbox/Zwayam APIs · Gate 11 order · Finance packs · new repo · 44-sub-function theatre · inventing measured KPIs · lifting dual-employment stop · reopening CENSUS-PACK / Offer Desk Rashmi rows as a rewrite

Non-negotiables: Spec deny without evidence · talk-only empty · 95 vs 61.8 both visible · fabricated ≠ Rashmi · guest mints no key · IoPanes + i-buttons

---

## PHASE A — CHRO can sit (~45% canon)

### V10-1 Census record + language — **UNLOCKED**

| | |
|---|---|
| **Claude (lead)** | `censuses` table RLS: id, client_id, work_system_id, status, scope json, document_requests json, created_at. GET/POST `/api/censuses` get-or-create; POST start. Wire consent + 3 seats + “docs asked” as **booleans from existing data** (do not fake received files). |
| **Cursor (same PR only after API exists, or wait)** | Scope screen: **Start census**; readiness strip 3 rows (consent / people / docs) honest red/green. Customer copy on `/census/*` Chart Plan headings: piece of work, how sure we are, how we know it, checked by, careful / as calculated / ambitious. Coined terms in i-buttons only. |

**Done when:** Start creates a row that survives refresh; strip visible; Playwright 1→6; download still 95/61.8; Spec deny unchanged.
**Out:** login, PDF, 18-leaf, V10-2.

---

### V10-2 Pointers + resolver + 5 statuses — Claude lead, Cursor UI after API

Claude: pointer columns (file_id, page, line, cell); resolver on write (fail → gap + fabrication_count); statuses observed/declared/reconstructed/composed/predicted; binding fields declared+quote only.
Cursor: Evidence click claim → pointer or “cannot open”; composed badge; plain-word statuses.

---

### V10-3 Verify + certify + 5th gate — Claude lead

Claude: verification_design on unit (method, independent, sampling, cost or not stated); cert class separate from provenance; 5th gate from confirmed intent; error-cost = contestable default; handoff Not ready if check not independent where required.
Cursor: Plan columns how sure / checked by / independent?; dual-track copy (do vs check).

---

### V10-4 Chart 18-leaf + bands — **Cursor lead** (Claude only if seed must persist)

Cursor: v8.1 18-leaf seed mapped to T&M hours; bands automate/augment/human/**external**; composite “hire complete”; synthetic names on Chart/Plan/export.
Claude: persist leaf codes if they must be Work Units in DB; otherwise frontend seed is enough this slice.

---

### V10-5 Gap 3 tiers + Outcome — Cursor UI + Claude `outcome_records`

Tier 1 swimlane (v8.1 11-step as declared sitting) vs owned pieces. Tier 2 journey owner. Tier 3 promised vs **not measured** (never invent). Head vs doer stays.

---

### V10-6 Plan economics — Cursor lead

Three costed cases from existing economics or “not stated”; residual-harm + exposure rows; portfolio of this journey; export assumptions. 95/61.8 stay. Stop still unliftable.

---

### V10-7 Login — Claude after founder says **Clerk** (default if silent)

Signup, org, first census, invite 2 emails. Org keys stay for Spec. Guest walk without login. **Host payment: after 30 Sep.**

---

## PHASE B — 45% → 80% canon

Locked until V10-7 decided (login may trail if founder delays vendor; do not block 8–11 on Clerk).

| ID | Lead | Slice |
|---|---|---|
| V10-8 | Claude API + Cursor UI | Field-level confirm at CHRO sit close + decision cards |
| V10-9 | Claude | Strategy intent one line + intent-debt count |
| V10-10 | Claude ingest + Cursor objects | EG-lite + PDF page pointers |
| V10-11 | Claude | States + admissibility tests on a cut |
| V10-12 | Claude | Discovery as performer + 4 delinquency counters + Offer Desk golden set |
| V10-13 | **Cursor** | Case simulator + capacity labelled not-live |
| V10-14 | Claude | Handoff withholds scores + invariants fail CI |

---

## This week — exact prompts

### Claude Code — + New, `git pull origin main`

```
Read docs/V10_BUILD.md and docs/BUILD_PROGRAM.md. Execute ONLY V10-1 BACKEND + the thinnest hook the UI needs.

- censuses table, RLS, Alembic, GET/POST /api/censuses (get-or-create + start)
- Readiness booleans from EXISTING consent receipts, scout sessions (3 seats), uploaded files count — do not invent a document-request workflow
- Do not rebuild Chart/Plan/Spec. Do not start V10-2. Do not do customer-copy (Cursor).
Tests against real Postgres. HONESTY.md. PR claude/v10-1 → main. Squash-merge CI green. Stop.
```

### Cursor — after Claude’s V10-1 PR is **merged** (not before)

```
Read docs/V10_BUILD.md. V10-1 FRONTEND only. Branch cursor/v10-1-ui off latest main (must include censuses API).

- Start census on Scope; readiness strip 3 rows from GET /api/censuses (honest empty)
- Headings on /census/*, Chart, Plan: piece of work / how sure we are / how we know it / checked by / careful, as calculated, ambitious. i-buttons for canon terms.
- Do not add tables. Do not touch Spec deny or 95/61.8 logic.
Playwright: Start → 1 of 6; strip visible; 1→6; download contains 95 and 61.8; guest mints no key.
PR → main. Stop. Do not start V10-4 until Grok unlocks it.
```

### Cursor **this week if Claude has not merged yet**

Idle on features. Allowed: read-only review of Chart copy; **no PR**.

---

## Unlock order (Grok only)

1 → Cursor UI 1 → 2 (Claude then Cursor) → 3 → **4 Cursor** (parallel with 3 only if 3 does not edit Chart) → 5 → 6 → 7 → Phase B 8…14 as table above.
