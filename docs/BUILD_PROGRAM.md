# Build program — Work Engineering

**Status:** operating instruction. Not a backlog dump. Not a licence to build tracks 0–6 in one session.

This file is what Claude (or Cursor) **validates**, then **executes one unlocked slice** of. If a slice needs a founder decision, the agent **stops and writes the question** — it does not guess.

Related: [STATUS.md](STATUS.md) (what is true), [HONESTY.md](HONESTY.md) (ledger), [ROADMAP-DECISIONS.md](ROADMAP-DECISIONS.md) (proposals), [CURSOR_V9.md](CURSOR_V9.md) (historical V9 brief).

---

## 0. Why not “autonomously build tracks 0–6”

That request maximises **lines**, not **a demo you will give**.

Tracks mix three kinds of work:

| Kind | Example | Who |
|---|---|---|
| **Verify live** | Hosted guest walk | Agent + founder click |
| **Implement under a frozen contract** | Gate 10 gap at import | Agent |
| **Product decision** | WorkOS vs Clerk; Finance catalog | Founder only |

One session that does all three will: invent catalogs, wire login before a CHRO exists, treat `offer-desk-inputs/` as Rashmi, and ship Gate 11-as-order after we already rejected it.

**Velocity that is real:** one slice, live bar, merge, next unlocked slice. Parallel agents only when they cannot touch the same files.

---

## 1. Non-negotiables (fail the slice if broken)

1. Specification layer. We do not execute Offer Desk work.
2. Talk-only persist stays empty. Completeness is not clearance.
3. Declared ≠ observed. Fabricated packs stay labelled fabricated.
4. 95 hrs/mo stays visible next to 61.8. Do not overwrite the sheet claim.
5. Dual employment = stop. Appetite does not lift it. Helper may not release an offer.
6. Two graphs stay two graphs.
7. No Zwayam/Zoho/UAN connector theatre. No invented traces.
8. Gate 11 **order is not enforced**. Scout generate may label `inferred`; file import stays `detailed`; no predecessor check.
9. Org API keys stay when login exists.
10. Work on `main` (or `feat/<slice>` → `main`). Do not revive `idea/v9`.
11. Hosted pitch URL must keep working. A 500 on Set up the demo or guest Hours is a P0, not a later ticket.
12. IoPanes (Given / How we understand it / What the platform does / Output) on new V9 walk screens.

---

## 2. How an agent is allowed to run

```
validate BUILD_PROGRAM → pick the single UNLOCKED slice → implement
→ tests + Playwright → hosted verify if the slice touches UI/API on Render
→ HONESTY.md one paragraph if behaviour changed → commit → stop
```

**Stop** means: do not start the next slice in the same session unless the slice card says `chain: yes` (Track 0 only).

If you hit a **STOP-GATE**, write `DECISION_NEEDED.md` (or a PR comment) with options A/B and a recommendation. Do not pick for the founder.

---

## 3. Track cards

### Track 0 — Pitch that does not die

**Intent:** A stranger and a colleague can both use https://work-engineering.onrender.com without you.

| ID | Slice | Unlocked when | Done when | Kind |
|---|---|---|---|---|
| 0.1 | Live guest walk green on **hosted** URL (not localhost) | now | Incognito, no key, Home → … → Hours 95/61.8, guest banner, no 500, no V8 1-of-7 | Verify |
| 0.2 | Cold-start copy if Render sleeps | 0.1 red on idle | First request shows “waking the demo”, not a blank error | Implement |
| 0.3 | `docs/PITCH.md` + README walk = guest first, setup second | 0.1 | Co-founder clone matches the meeting | Docs |
| 0.4 | Honesty pass on 92.73 view | now | Banner still says fabricated / not Rashmi, above the fold | Verify |

**STOP-GATE:** paid Render vs sleep. Agent may document; may not buy a plan.

**Chain:** 0.1 → 0.3 may run in one session if 0.1 is already green.

---

### Track 1 — Specification quality

**Intent:** Import tells the truth. Scout still cannot sneak past GQS.

| ID | Slice | Unlocked when | Done when | Kind |
|---|---|---|---|---|
| 1.1 | Gate 10: declared unit with no observed twin → `ConformanceGap` at import (warn, P2) | Track 0.1 green | Test: import declared-only creates gap; observed twin does not; Scout generate still blocked by GQS | Implement |
| 1.2 | Gate 6: multi-object / multi-authority → `split_recommended` **warning**, not reject | 1.1 | Test: comma/“and” in business_object warns; import still accepted | Implement |
| 1.3 | Gate 9: infer BO states from current/desired; warn if no terminal and ≥3 units | 1.2 | Test: 2-unit BO exempt; 3-unit with no sink warns | Implement |
| 1.4 | HR Function Pack v0: `packs/hr/` YAML — question bank mapped to 18 attrs; `scout pack validate` 100% coverage | 1.1 | CLI fails if an attr has zero questions; existing HR bank is source, not invented | Implement |

**Do not build:** Gate 11 predecessor check.

---

### Track 2 — Capture (declared arm)

**Intent:** A real sitting can start without the founder.

| ID | Slice | Unlocked when | Done when | Kind |
|---|---|---|---|---|
| 2.1 | Consent UI before Scout generate-genome (API already rejects missing receipt) | 1.1 | Screen creates/selects receipt; generate without it still 4xx; copy is layman | Implement |
| 2.2 | Stand-in CHRO / HR Ops remain labelled until a real transcript is attached | 2.1 | No fake quotes | Policy |
| 2.3 | SME **product** door (today a label) — only after Offer Desk guest walk is the default pitch | Track 0 + founder yes | Same honesty as Enterprise; no second catalog | STOP-GATE |

---

### Track 3 — Observed arm

**Intent:** One real file from a pilot, not a connector platform.

| ID | Slice | Unlocked when | Done when | Kind |
|---|---|---|---|---|
| 3.1 | Ingest path: existing `/files/upload` + mapper → candidate WUs → gaps only | Founder names the file/system | Unmatched → ConformanceGap; **zero** auto-written Work Units | Implement |
| 3.2 | Replace `offer-desk-inputs/` in any pitch script | 3.1 on **customer** data | Pitch never uses fabricated pack as Rashmi | Docs |

**STOP-GATE:** which system (Jira / ServiceNow / their Excel). Do not pick Zwayam to look complete.

---

### Track 4 — Customer identity

**Intent:** A CHRO logs in. Machines keep org keys.

| ID | Slice | Unlocked when | Done when | Kind |
|---|---|---|---|---|
| 4.0 | Decisions | Founder | WorkOS vs Clerk vs Auth0; 3 vs 4 roles; keys stay (default: WorkOS, 3 roles, keys stay) | STOP-GATE |
| 4.1 | WorkOS (or chosen) session JWT + `users.client_id` + RLS unchanged | 4.0 written | Signup = **empty** tenant, not Client A | Implement |
| 4.2 | Roles Admin / Editor / Viewer on existing routers | 4.1 | Viewer cannot generate/import; Admin rotates keys | Implement |
| 4.3 | Pitch instance: bootstrap stays; **customer** instance: `DEMO_BOOTSTRAP_ENABLED=false` | 4.1 | Documented in STATUS | Implement |

`app_users` table already exists and is inert. Do not redesign it.

---

### Track 5 — Next function

**Intent:** A second function only with a human-reviewed list.

| ID | Slice | Unlocked when | Done when | Kind |
|---|---|---|---|---|
| 5.0 | Domain expert marks up Finance and/or Legal tables in ROADMAP-DECISIONS.md | Founder + reviewer | Diff of names, merges, drops | STOP-GATE |
| 5.1 | Drop reviewed list into blast-radius catalog; placeholders remain for the rest | 5.0 | Same UI as HR; no invented owners/unit counts | Implement |
| 5.2 | Operations | Never until a customer names what Operations means | | STOP |

---

### Track 6 — Operate

**Intent:** A 500 pages us, not a guest.

| ID | Slice | Unlocked when | Done when | Kind |
|---|---|---|---|---|
| 6.1 | Alert on API 5xx (Render / email / whatever is already connected) | Track 0 | Bootstrap-class 500 is visible within 5 minutes | Implement |
| 6.2 | Postgres backup policy documented + enabled | 6.1 | STATUS names RPO | Ops |
| 6.3 | Load test | Design partner scheduled | | Later |

---

## 4. Default sequence (do not reorder without a written why)

```
0.1 hosted guest verify
0.3 PITCH + README          ← same session only if 0.1 already green
1.1 Gate 10
1.4 HR Function Pack v0
2.1 Consent UI
1.2 Gate 6 warn
1.3 Gate 9 warn
6.1 5xx alert               ← can parallel 1.x if different files
then STOP-GATES: 4.0, 3.0 (system), 5.0 (catalog)
then 4.1–4.3, 3.1, 5.1 as unlocked
```

---

## 5. Out of program (refuse)

- Execution / agents that release offers or run Zwayam
- Gate 11 as `detailed` requires `inferred`
- Invented Finance/Legal/Operations catalogs
- Treating `offer-desk-inputs/` as production
- New repo, rewrite of V8 backend, `idea/v9` revival
- Two agents on Offer Desk files at once

---

## 6. Slice report template (every PR / commit message body)

```
Slice: <id>
Unlocked because: <pointer>
Done when evidence:
- tests: <path> <pass count>
- hosted: <url> <pass/fail>   (or N/A + why)
Honesty: <yes/no ledger line>
Did not do: <temptations refused>
STOP-GATE opened: <none | question>
Next unlocked: <id>
```
