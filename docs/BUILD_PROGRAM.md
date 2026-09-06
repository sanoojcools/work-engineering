# Build program — Work Engineering

Architecture map = WEP System Architecture (boxes 1–6).
**Bet:** tighten the **joints** of 3a–3e on Offer Desk until a founder can point at each artefact on the walk. Do not fill Box 1/2/4/6 with theatre.

---

## Pending slices (alignment table)

**`TIGHT-WEDGE` (T1–T6 together) shipped in one PR, not split.** Nothing else is unlocked until 6.2 / 4.0 / 3.0 / 5.0 are answered.

| ID | Box / joint | Status | Who | Done when |
|---|---|---|---|---|
| **TIGHT-WEDGE** | **3a–3e on Offer Desk** | **SHIPPED** | Claude, one PR | See T1–T6 below, all in the same PR |
| T1 | **3b→3c** checkable desired condition | shipped | Claude | Document check **unit card**: before/after/acceptance/evidence/dual-employment stop. Uncheckable desired → **warn**, not reject |
| T2 | **3b O1** Work Graph | shipped | Claude | **Sequence edges** for 11 Offer Desk steps after keyed import. No other edge types. Guest: no fake arrows |
| T3 | **3c** verification artefact | shipped | Claude | Document check **verification spec card** (method, independent checker in words, file hash if uploaded). **No** promote/demote ladder |
| T4 | **3a** coverage map | shipped | Claude | Gap: real kinds + “what we cannot see” (no Zwayam; judgment-blind). No fake coverage % |
| T5 | **Box 2** contract freeze | shipped | Claude | `docs/INTENT_CONTRACT.md` only. **No INT-007 tables** |
| T6 | **3e** honesty | shipped | Claude | Hours: 95 vs 61.8 stay. If pack hours (72.2) appear, footnote they are a **different** calc |
| **6.2** | Operate: Postgres backup | **STOP-GATE** | Founder | Free DB, **no backup, expires ~2026-10-05**. Pay or lose the pitch instance |
| **4.0** | Identity | **STOP-GATE** | Founder | Login vendor? Default: **wait** for a named CHRO |
| **3.0** | 3a upward traces | **STOP-GATE** | Founder | Which **real** file? Default: wait |
| **5.0** | Next function | **STOP-GATE** | Founder + reviewer | Finance/Legal markup. Default: wait |
| **2.3** | SME product door | STOP-GATE | Founder | After Offer Desk is the default pitch |
| **3d-S** | 3d scenarios S1/S2/S3 | Later | — | Do **not** productise appetite scenarios until TIGHT-WEDGE is on the walk |
| **3c-L** | 3c promotion ladder | Later | — | Needs evidence runtime (Box 5). Out of scope |
| **3b-E** | 3b other edge types | Later | — | Shared object / resource / reciprocal — after sequence is true |
| **1.** | Box 1 enterprise graph | Later / partners | — | Consume by reference. Do not build Palantir |
| **2-E** | Box 2 intent **engine** | Later | — | After T5 contract exists and a COO will own INT-007 |
| **4+5** | Execution | **Refuse** | — | Below Spec. Stay refused |
| **6.** | Simulator | Later | — | After a scenario portfolio a customer adopted |
| **6.3** | Load test | Later | — | Design partner scheduled |

### Already shipped (do not reopen)

0.1 hosted guest Hours · 0.2 waking banner · PITCH-FACTORY (#10 Gap live) · 1.1 Gate 10 · 1.2 Gate 6 · 1.3 Gate 9 · 1.4 HR pack · 2.1 consent UI · 6.1 health 503 / request id · **TIGHT-WEDGE (T1–T6)**: Document check unit card + checkability warn (T1), Offer Desk Work Graph — 11 real sequence edges, no other types (T2), verification spec card on Document check — method, independent checker named honestly, optional file hash, no promotion ladder (T3), Gap "what this sitting cannot see" (T4), `docs/INTENT_CONTRACT.md` (T5), Hours 95/61.8 unchanged + 72.2 footnote guard (T6)

---

## Non-negotiables

1. Spec layer — no execution of Offer Desk.
2. Talk-only persist empty.
3. Fabricated pack labelled fabricated / not Rashmi / not a Zwayam connector.
4. 95 and 61.8 both visible; do not merge 72.2 into 61.8.
5. Dual employment = stop. Helper may not release an offer.
6. Two graphs stay two graphs.
7. Gate 11 order is **not** enforced.
8. Org keys stay if login ever exists.
9. `main` only. IoPanes + i-buttons on new walk screens.
10. Guest Hours must still work with no key.

---

## TIGHT-WEDGE (shipped)

One PR. Maximum tightness we can earn **without** founder STOP-GATES.

**Walk after merge (keyed):** Offer Desk → Document check **unit card** → verification spec → Work Graph **11 arrows** → Gap (real kinds + cannot-see) → Hours 95/61.8.
**Walk guest:** unchanged Hours; no fake graph; no fake unit rows.

Refuse: WorkOS, Gate 11, Finance, Box 4, buy Render, four edge types, S1/S2/S3 product, INT-007 schema, Palantir Box 1.

Slice report: ID `TIGHT-WEDGE`. Next unlocked: none until 6.2 / 4.0 / 3.0 / 5.0 answered.
