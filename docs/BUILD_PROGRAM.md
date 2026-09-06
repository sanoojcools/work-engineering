# Build program — Work Engineering

**Status:** operating instruction. Architecture map = WEP System Architecture and Component Map (boxes 1–6). This file says what we **tighten next**, not a licence to build every box.

Related: [STATUS.md](STATUS.md), [HONESTY.md](HONESTY.md), [ROADMAP-DECISIONS.md](ROADMAP-DECISIONS.md), [PITCH.md](PITCH.md), [OPS.md](OPS.md).

---

## 0. Bet (unchanged)

Specification layer. Scout sit → genome (saved cut) → Work Units → Spec allow/deny.
We do **not** execute Offer Desk. Box 4+5 stay below the Spec API.
Box 2 (Intent) stays empty until we freeze a contract — we do not fake INT-007.
Box 1 is not Palantir. Box 6 is not this quarter.

**Craft:** a genome you cannot bullshit into existence. Tightness = joints in the architecture map, not more advisory gates.

---

## 1. Non-negotiables

1. Specification layer. We do not execute Offer Desk work.
2. Talk-only persist stays empty. Completeness is not clearance.
3. Declared ≠ observed. Fabricated packs stay labelled fabricated / not Rashmi.
4. 95 hrs/mo stays visible next to 61.8. Do not overwrite the sheet claim. Do not reconcile 72.2 into 61.8.
5. Dual employment = stop. Appetite does not lift it. Helper may not release an offer.
6. Two graphs stay two graphs (Enterprise Graph ≠ Work Graph).
7. No Zwayam/Zoho/UAN connector theatre. No invented traces.
8. Gate 11 **order is not enforced**.
9. Org API keys stay when login exists.
10. Work on `main`. Do not revive `idea/v9`.
11. Hosted pitch URL must keep working. Guest Hours 500 is P0.
12. IoPanes on new V9 walk screens. Formal names in brackets / i-buttons.

---

## 2. How an agent runs

```
validate BUILD_PROGRAM → ONE unlocked slice → tests + Playwright
→ HONESTY.md → PR to main → squash-merge when CI green → stop
```

STOP-GATE: write the question. Do not guess (auth vendor, paid Render, Finance catalog, which customer file).

---

## 3. Shipped (do not reopen)

| ID | What | Evidence |
|---|---|---|
| 0.1 | Guest walk hosted | Founder: incognito Hours 95/61.8 |
| 0.2 | Waking banner | Guest walk slice |
| PITCH-FACTORY | Gap shows real ConformanceGap kinds; pack validate in CI; evidence banner | PR #10 |
| 1.1 Gate 10 | undeclared gap, warn | PR #4 |
| 1.2 Gate 6 | split_recommended, warn | PR #7 |
| 1.3 Gate 9 | missing_terminal_state, warn | PR #8 |
| 1.4 | packs/hr + `scout pack validate` | PR #5 |
| 2.1 | Consent UI before generate | PR #6 |
| 6.1 | health 503 + structured 5xx + request id | PR #9 |

---

## 4. Architecture tightness (this is the new sequence)

Map: Box 1 container · Box 2 TBD · **3a Discovery** · **3b Cut + Work Graph** · **3c Verification** · **3d VERDICT** · **3e Economics** · 4+5 below Spec · 6 later.

We already have the *words* of 3a–3e on Offer Desk. Tightness = each **joint** is checkable on the walk, not a slide.

| ID | Joint in the map | Slice | Done when |
|---|---|---|---|
| **T1** | **3b→3c** “unit leaves cutting only if desired condition is checkable” | Offer Desk 11 steps persist as Work Units (keyed path only) with current/desired, acceptance, evidence_required. Lint: uncheckable desired → warning, not reject. Guest still read-only. | Founder can open a **unit card** for Document check: before/after/evidence/stop. Tests for the lint. |
| **T2** | **3b Work Graph O1** (doc: largest unbuilt gap) | **Sequence edges only** for the 11 Offer Desk steps (step N → N+1). Typed `sequence`. No shared-resource / reciprocal theatre. Cycle check already exists — keep it. Walk: Work Graph page shows those 11 arrows after keyed import. | Playwright: keyed + import → graph has sequence edges; guest graph does not fake them. |
| **T3** | **3c artefact** | Document check verification spec card: method, checker independence in words, evidence hash if a file was uploaded. Matches the architecture snapshot *in feel*, not a fake ladder. | Screen + IoPanes. Promote/demote ladder still **not** built. |
| **T4** | **3a coverage map** | Gap screen already lists undeclared / split / missing terminal. Add one line: **what this sitting cannot see** (no Zwayam connector; judgment zones). | Copy only; no fake coverage %. |
| **T5** | **Box 2 contract freeze** (design, not engine) | `docs/INTENT_CONTRACT.md`: fields an intent record **must** carry for 3a to derive declared candidates. Downstream already needs outcome + constraints + owner. **Do not implement INT-007 tables.** | Doc + one test that the Offer Desk sitting can *point at* missing intent (declared-only), not invent strategy decks. |
| **T6** | **3e honesty** | Hours screen already 95 vs 61.8. Add a footnote: sample-pack hours (e.g. 72.2) are a **different calculation** if they appear. | No merge of the two numbers. |

**Refuse in tightness work:** Box 1 living enterprise graph, Box 4 execution, Box 6 simulator, four edge types, VERDICT S1/S2/S3 productisation, WorkOS, Finance catalog, Gate 11.

**Default next slice = T1+T2+T3 in one PR** (one desk, one graph, one spec card). T4–T6 may ride along if they are copy/docs. Do not split T1–T3 across three weekends.

---

## 5. STOP-GATES (founder, not Claude)

| ID | Question | Default |
|---|---|---|
| **6.2** | Render Postgres is **free, no backups, expires ~2026-10-05**. Paid plan? | Founder. Agent must not buy. |
| **4.0** | Person login (WorkOS vs Clerk)? | **No** until a named CHRO types |
| **3.0** | Which real observed file? | **No** until they give a CSV |
| **5.0** | Finance/Legal catalog? | **No** until a human marks ROADMAP-DECISIONS |

---

## 6. Still later (do not pull forward)

- Track 4 login wiring
- Track 3 mapper for a customer file
- Track 5 second function
- 6.3 load test
- Typed edges beyond sequence
- Promotion/demotion ladder (3c engine)
- Workforce simulator (Box 6)

---

## 7. Out of program (refuse)

- Execution / agents that release offers or run Zwayam
- Gate 11 as detailed-requires-inferred
- Invented Finance/Legal/Operations catalogs
- Treating `offer-desk-inputs/` as Rashmi
- New repo, `idea/v9` revival
- Two agents on Offer Desk files at once

---

## 8. Slice report template

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
