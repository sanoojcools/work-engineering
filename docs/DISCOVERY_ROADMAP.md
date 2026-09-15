# Discovery roadmap — execute this, not NEXT.md leftovers

**Canon:** [WEP_Discovery_Proposal.md](./WEP_Discovery_Proposal.md) v2.  
**Spine:** census stays 6 steps. Discovery is Capture seats + Playback + Sit close.  
**On main already:** V10-1…14, Mandates 1–4, sit-close, strategy_intent columns, extract-from-story, next-questions.  
**Do not rebuild** Chart 18, Plan 95/61.8 as two numbers, Gap buckets, Spec deny, dual-employment lift.

**Bar:** if they cannot point at the sentence they typed, it does not go on the glass. No scrape. No 72%. No invented days.

---

## Sequence (fat, few)

| ID | Who | What | Unlocks |
|---|---|---|---|
| **D-1 BACKEND** | Claude **now** | Persist CHRO answers on the existing `function_head` session. Draft `strategy_intent_focus` from a **verbatim substring**. Pack hard-anchors as YAML + GET. | Cursor D-1 UI |
| **D-1 FRONTEND** | Cursor **after D-1 API on main** | Pain-to-permit sitting on Function leader. One question at a time. Draft line from their text. Pack anchors as confirm. Guest types, no key. | D-2 |
| **D-2** | Cursor | Playback from **stored answers**, not `PLAYBACK_ROWS`, once any real text exists. Confirm/Correct = existing sit-close shape. Empty stays empty. | named sitting |
| **D-3** | Claude | Port guardrail **rules** into WEP extract path (one `?` if LLM talks, no automation-framing, fail closed, no mock). Not a scout-v1/aodp import. | D-5 |
| **D-4** | Cursor | Ops seat: trigger / end / systems; predict-and-validate from **this tenant** tags. | — |
| **D-5** | Cursor | SME dump → existing `extract-from-story` → is this you? Sit-close still quote-gated. | — |

**This week:** D-1 BACKEND then D-1 FRONTEND. Then D-2. Do not start D-3 until D-1 UI is on main (unless Grok says otherwise). Named human sitting is a founder action, not a PR.

---

## Collision

Claude: `backend/`, `packs/hr/hard_anchors.yaml`, `docs/HONESTY.md`, tests.  
Cursor: `frontend/src/pages/OfferDeskFunctionLeader.tsx` (D-1), then `OfferDeskPlayback.tsx` (D-2). **Not both in one PR.**  
Neither edits `CensusPlan.tsx` 95/61.8 math, `hire_leaves.yaml` count, or `handoff.py` stop.

---

## Refuse (every slice)

Glassdoor/Blind/BuiltWith scrape · invented cycle-time · LLM % confidence · seventh census step · merge scout-v1/aodp · CHRO asked s1 offer-steps · seed strategy as if discovered · lift dual-employment

---

## Done-when (product English)

After D-1 both halves: a keyed CHRO can type what broke, confirm a draft this-period line that is **their words**, and Plan shows that line (or still the old seed if they never sat). Guest can type and see playback of **this walk only**, mints no `we-spec-key`. Census still 1 of 6 … 6 of 6. 95 and 61.8 still two numbers.
