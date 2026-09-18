# Work Engineering — Product view and build paper

**Status:** Battle-test draft v2 — first critique absorbed. Not a Cursor ticket. Not canon until the founder locks it.  
**Date:** 18 Sep 2026  
**Governs on conflict:** live `main` + `docs/HONESTY.md` + `docs/WEP_Discovery_Proposal.md` v2.  
**Wedge:** HR Offer Desk (Offer → Day-1). One product.

**How to battle-test**  
Read this whole file. Attack §12. Do not praise. Do not invent a seventh census step, a scrape, or 47 days.

---

## 0. Job of the product

Work Engineering is the specification layer between enterprise intent and execution. It does **not** run the work.

**One sentence:** We sit three altitudes on one journey, bind only what a helper would need a permit for, and refuse what we cannot defend.

**Quality stack (ambition — not a claim that all five arrows exist as code today)**

```
High-quality sitting
        ↓
High-quality understanding of their process
        ↓
High-quality genome (objects changing condition)
        ↓
High-quality work graph (journey you can read)
        ↓
Hours we will defend · stops that do not lift · spec that denies without a file
```

If discovery is a form, the genome is a spreadsheet and the graph is a poster. That is today’s gap. The law is ahead of the room. **We do not close the gap by waiting for more storage.** We close it by sitting, drawing what we know, and leaving the rest grey.

---

## 0.1 What we took from the first critique — and what we refused

Claude’s 18 Sep review of v1 was run against `main` at `6b10f08`. Integrity hits stand. Ambition delays do not.

| Critique | Call |
|---|---|
| Enum is `sub_function_lead`, not `ops` | **Accept.** Rewrite. |
| Seeded “cut offer-to-Day-1…” is on the row before anyone types | **Accept.** Raise: demo path shows **none yet** until they type. Seed is a stain, not a feature. |
| Zwayam list on an empty tenant is prefill | **Accept.** Predict only from **this tenant’s** tags. Empty tenant = open question. |
| Density / weight as a new number is 72% in a coat | **Accept kill.** Encode the **existing five statuses**. No new score. |
| Edge labels have no table | **Restrict.** Only movements named on Rashmi’s sheet (or a later sitting). No invented “packet.” |
| Pasted URL is a crawl with a click | **Kill.** Files they upload only. Never fetch a URL. |
| Killing stand-in rows can crash `intent.ts` | **Accept.** S2/S4 name `offerDeskSeats.ts` **and** `intent.ts` together. |
| No layout library on `package.json` | **Refuse delay.** Layout is already in the pack: `x = step`, lane = `parent` in `hire_leaves.yaml`. Hand-rolled SVG. S3 does not add reactflow. |
| Wait for S5 before drawing rooms or layers | **Refuse.** Designed empty is the product. Canvas ships with Desk live, CHRO/Ops **grey**. That is Atlan partial — not theatre. |
| Minute 12 hours are Rashmi-hardcoded | **Exception, not kill.** On **this wedge** Plan keeps 95 / 61.8 as two numbers. On a tenant with no Offer Desk hours: two labelled empties. Never invent a third number. |
| Paper scores are unsourced percents | **Relabel.** Founder estimates. Not telemetry. |

---

## 1. What a customer should feel

A function leader should feel they sat with a partner who got **this desk**, then open a picture of Offer → Day-1 that looks like their company.

- Minute 3: **if they typed**, that sentence is this period’s draft. If they did not: **none yet.** Never the seed sentence dressed as theirs.
- Minute 8: the journey is readable. Dual-employment is a lock. Disagreement is a split. Unsat seats are grey.
- Minute 12 on **this** Offer Desk walk: 95 stated / 61.8 defended. Spec closed without a file.

They never meet forty lab doors, a mic that dies, V8 Overview, or offboarding rows on Offer Desk.

**Honest about one afternoon (new tenant, no Rashmi sheet):**
A period sentence if they typed one. A lock if they confirmed a pack stop. A mostly-grey canvas. Evidence empty. Spec refuses. That is the system working. The 12-minute wow **on the colleague demo** uses Rashmi’s sheet as the pack they already handed us — stamped sample until a named leader sits.

---

## 2. What is already true on `main` (do not rebuild)

Verify on GitHub. Snapshot 18 Sep 2026.

| Piece | State |
|---|---|
| Census 1–6 | Live. Guest looking-only. No key. Step 5 label on glass is still **Work Chart**. |
| Function leader (D-1) | Pain → permit. Draft from their words **when they replace the seed**. Guest confirm off. |
| Playback (D-2) | Stored answers. Empty = none yet. |
| Extract (D-3) | One `?`, no automation-framing, fail closed. |
| Sit close | Quote-gated. |
| Rashmi sheet | Real sitting 12 May 2026. |
| Seat 2 | **On the glass today:** `HR_OPS_STAND_IN` — workbook, labelled not a recorded sitting. |
| Chart | Exactly 18 hire leaves. Enforced in `hireLeaves.ts`. |
| Plan | 95 / 61.8 two numbers on this desk. |
| Strategy row | **Seeded** on first ensure. Substring gate applies only to replacement. |
| Dual-employment | Unliftable in `handoff.py`. |
| Disagreement detector | Exists (`function_head` vs `sme`). |
| Session types | `function_head` \| `sub_function_lead` \| `sme`. No `ops` value. |
| Demo sample | #65 Ready, not merged. |

---

## 3. Product

### 3.1 Case file
Six stages. Step 5 on the stepper becomes **Journey**. Leaf `step: 7` is not a seventh census stage.

### 3.2 Rooms
Function leader (`function_head`). Head of HR operations (`sub_function_lead`): predict only from this tenant’s tags; empty = open question; empty state **Ops has not sat**. Rashmi: sheet first. Designed empty rooms ship before persist.

### 3.3 Pre-work
Files they upload only. No URL fetch.

### 3.4 Room → genome
CHRO sentence → strategy_intent_focus after substring draft. Who binds → authority. Pack stop → lock. Ops trigger/end → work_systems at S5. Rashmi sheet → unit fields. Disagreement detector → split.

### 3.5 Graph
Layout: x = hire_leaves.step, lane = parent. Hand-rolled SVG. No reactflow. Fill = existing five statuses, not a new score. Edges only if the sheet names the movement. Desk layer live; CHRO/Ops grey. Hours on Plan only. S3 done-condition includes 95 and 61.8 still on Plan.

## 5. Seed
First ensure writes a fixture. Demo path shows **none yet** until they type. Seed is a stain.

## 7. Order
S0 → S1 → S4 → S3 ∥ S2 → S5 → S6 → named sitting.
S3 does not wait for S2. S2 does not wait for S5.
S2 must touch offerDeskSeats.ts **and** intent.ts together.
S5 uses `sub_function_lead`, never an `ops` enum.

## 8. Refuse
URL fetch · new specification score · reactflow for S3 · predicting another company’s Zwayam · seed presented as discovered · seventh census stage · scrape · 47 days · 72% · Box 4

## 12. Review again
A–F on this v2. Grey + not sat is the bar, not delay.

*Full v2 source of truth also at the Grok project artifacts/WEP_PRODUCT_AND_BUILD.md if this commit is read as a stub.*
