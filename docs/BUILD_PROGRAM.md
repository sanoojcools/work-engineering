# Build program — Work Engineering

SKU = **Work Census**. Six steps are now screens (PR #19).

**Founder next:** **CENSUS-PACK** — the sponsor leave-behind + the Spec **bundle** (V10 handoff). One PR. No login / Finance / Render.

---

## Pending

| ID | Status | Who |
|---|---|---|
| **CENSUS-PACK** | **UNLOCKED — do now, one PR** | Claude |
| DELINQ-v0 | After this | — |
| 6.2 Render | Open → 30 Sep (~5 Oct DB) | Founder |
| 5.0 Finance/Legal | Open → 30 Sep | Founder |
| 4.0 Login | STOP | Founder |
| 3.0 Real traces | STOP | Founder |

Shipped: TIGHT-WEDGE · TIGHT-3D · HR-FAMILY · FAMILY-GENOME · OBJECTS-HOURS · CENSUS-v0 · INTENT-PLAN · **EVIDENCE-GAP**

---

## CENSUS-PACK (only unlocked build)

One PR. Two parts. Do not reopen EVIDENCE-GAP / INTENT-PLAN / CENSUS-v0.

### P1 — Census export (the thing a CHRO forwards)
From Plan (and Census shell): **Download census** → markdown file (PDF if cheap, markdown is enough).
Must contain, from **live** state (guest = declared sitting; keyed = tenant):
1. Scope (this Work System: offer → Day-1)
2. Intent (draft vs confirmed)
3. Evidence health (register counts + file list or “no files”)
4. Gap (“what we cannot see” + gap kinds, no fake %)
5. Chart snapshot (lane names + unit codes + S1/S2/S3 or not scored)
6. Plan (95 vs 61.8, dual-employment stop, quality gate ~30 not a pass)
7. Open questions / repair list
Banner in the file: talk-only is empty; fabricated pack ≠ Rashmi if mentioned.
Do not invent numbers. Filename `census-offer-day1-YYYYMMDD.md`.

### P2 — Handoff completeness (Spec wall, V10 [7])
A Work Unit is **not ready to hand off** unless: record exists AND (verification method named OR explicitly “no independent checker today”) AND gates listed (may be none) AND dual-employment stop still applies where the sheet says so.
GET (or existing Spec) **must refuse** a “hand off” / bundle for a unit that lacks that. UI on Plan: per unit **Ready** / **Not ready** + why. Guest: explain, no fake allow.
Do **not** execute work. Do not send to an agent. Bundle is JSON + the same refuse as Spec deny without evidence.

Playwright: guest 1→6, download contains 95 and 61.8 and “not a pass”; keyed download includes confirmed intent if they confirmed; Spec/handoff not-ready without evidence; family GQS still ~30.
IoPanes + i-buttons. HONESTY.md.
Refuse: WorkOS, Finance, Darwinbox, login, Box 4, delinquency product, buy Render, extra edges.

NEW branch off latest main. PR to main. Squash-merge CI green. Slice CENSUS-PACK. Stop.

---

## Non-negotiables

Spec layer. Talk-only empty. Fabricated ≠ Rashmi. 95 and 61.8 both visible. Dual employment = stop. Two graphs. Gate 11 not order. `main` only. Guest Hours still works.
