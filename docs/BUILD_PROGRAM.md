# Build program — Work Engineering

Architecture map = WEP System Architecture (boxes 1–6).
**Bet:** tighten 3a–3e on Offer Desk. Do not fill Box 1/2/4/6 with theatre.

**Founder 6 Sep:** 6.2 (Render backup) and 5.0 (Finance/Legal) **deferred to 2026-09-30**. Keep both **open**. Do not pay, do not invent catalogs. **TIGHT-3D shipped 7 Sep. HR-FAMILY (VERDICT-CARD + 5-desk HR family) shipped 7 Sep, founder-authorized directly, not blocked on 6.2/4.0/3.0/5.0** — it adds no login, no execution, no new backend surface, so it does not touch what those four are gating. Next unlocked build = none until 6.2 / 4.0 / 3.0 / 5.0 are answered.

---

## Pending slices

| ID | Box / joint | Status | Who | Done when |
|---|---|---|---|---|
| **HR-FAMILY** | **VERDICT-CARD (3d) + 5-desk HR family** | **SHIPPED** | Claude, one PR | See below |
| **TIGHT-3D** | **3d scenarios + 3b field provenance** | **SHIPPED** | Claude, one PR | See below |
| **6.2** | Postgres backup | **OPEN until 2026-09-30** | Founder | Free DB, no backup, expires ~2026-10-05 |
| **5.0** | Finance/Legal | **OPEN until 2026-09-30** | Founder + reviewer | No catalogs until markup |
| **4.0** | Login | STOP — wait | Founder | Named CHRO |
| **3.0** | Real traces | STOP — wait | Founder | Their file |
| **2.3** | SME door | Later | Founder | |
| **3c-L** | Promotion ladder | Later | — | Needs Box 5 |
| **3b-E** | Extra edge types | Later | — | After sequence (shipped) |
| Box 1 / 2-E / 4+5 / 6 | Palantir, INT-007 engine, execution, simulator | Later or refuse | — | |

### Shipped (do not reopen)

Guest Hours · Gap live · Gates 6/9/10 · HR pack · consent UI · health 503 · **TIGHT-WEDGE** (unit card, 11 sequence edges, verification spec, cannot-see, INTENT_CONTRACT.md, 95/61.8) · **TIGHT-3D** (S1/S2/S3 scenario strip + field-provenance strip on Document check, gate-capped, not-scored honestly) · **HR-FAMILY** (VERDICT-CARD on Document check; Onboarding/Offboarding/Vendor Mgmt/US HR/HRBP desks from the real May 2026 T&M sittings; HR function graph with the 3 sheet-named cross-desk handoffs)

---

## HR-FAMILY (shipped)

One PR. VERDICT-CARD (architecture 3d snapshot) + the rest of the real HR family alongside Offer Desk.

**VERDICT-CARD — Document check.** V E R D I C T's seven scores, readiness (`Verdict.uncapped_level`) / restraint (how far a hard gate held recommended below readiness), recommended level, and applied gates translated to plain language — each with an i-button. Sits alongside the existing TIGHT-3D S1/S2/S3 strip, does not replace it. Not scored → "Not scored", never an invented number. Appetite does not lift the dual-employment stop; no Box 4.

**Desk family.** `frontend/src/lib/desks/types.ts` generalizes Offer Desk's own step-list shape (id, name, what happens, system, time, volume, automation tag, SPOC) into `DeskSpec`. Five real sittings — Onboarding, Offboarding, Vendor Mgmt, US HR, HRBP — parsed verbatim from `desks/*.xlsx` (the founder's real Trianz Time & Motion Study, May 2026) into `frontend/src/lib/desks/*.ts`; Offer Desk itself stays untouched (`offerDeskData.ts`), adapted into the same shape via `desks/offerDesk.ts` rather than re-parsed. `desks/README.md` carries the founder's own honesty line: Onboarding + Offboarding finalized, Vendor Mgmt/US HR/HRBP still need follow-up.

**Map.** `HrOps.tsx`: Offer Desk (live) + Onboarding + Offboarding + Vendor Mgmt + US HR, all clickable. `HrMap.tsx`: HRBP clickable as its own peer card, not folded under HR operations. TA / branding / workforce planning / total rewards stay grey.

**Function graph** (`HrFunctionGraph.tsx`, new). One node per desk; sequence edges are each desk's own step order; the only cross-desk HANDOFF edges drawn are the three the sheets themselves name (Offer Desk → Onboarding SPOC; Offboarding ↔ HRBP; Vendor Mgmt → Offer Desk for contractor conversion) — no shared-object/shared-resource/reciprocal edge types. US HR is its own parallel cluster (Job Vite, not Zwayam). Rashmi KN is named on both Offer Desk and US HR — one person, two desks, never merged, never drawn as an edge between them. Declared/sitting schematic for every viewer (guest and signed-in see the same page): none of the five new desks has ever been imported as a genome, so there is no observed backend data to gate on.

**Desk walks.** One shared `DeskWalk.tsx` component (overview + step list + SPOC + hours + link to the function graph) behind five thin pages — not a 12-tab Offer Desk clone per desk.

Refused, unchanged: WorkOS, Finance, Darwinbox API, extra Work Graph edge types beyond sequence + handoff, observed-pack theatre, backend rewrite, Box 4.

---

## TIGHT-3D (shipped)

One PR. Next tightness on the drawing after TIGHT-WEDGE.

**T3d-S — allocation scenarios (Box 3d artefact)**
On Document check (and Offer Desk units if cheap): show **S1 floor / S2 derived / S3 ceiling** as a **strip**, from existing VERDICT/readiness if present; if scores missing, show **not scored** — do not invent numbers.
**Hard rule:** appetite **never** lifts dual-employment stop. S3 cannot make “release offer” allowed without evidence. Helper may not release an offer.
Do **not** build org-moderation inbox, p*, actor-class runtime, or Box 4.

**T3b-P — field-level provenance (Box 3b contract card)**
Unit card shows **observed N / declared M** (and designed/inferred if those exist) for the 18 attributes. Matches the architecture snapshot “observed 7 · declared 11” *in kind*, using real field provenance, not a hardcoded 7/11.
Guest: educational copy, no fake counts from Client A.

**Walk keyed:** Document check → provenance strip + scenario strip → Spec deny still deny without file; dual-employment still stop at S3.
**Walk guest:** Hours 95/61.8 unchanged.

Refuse: WorkOS, Gate 11, Finance, buy Render, Box 4, ladder, extra edge types, INT-007 schema.

---

## Non-negotiables

Spec layer. Talk-only empty. Fabricated ≠ Rashmi. 95 and 61.8 both visible. Dual employment = stop. Two graphs. Gate 11 not order. `main` only. IoPanes + i-buttons.
