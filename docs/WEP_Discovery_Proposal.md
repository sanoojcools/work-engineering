# WEP Discovery Proposal

**v2 — top-bar lock (15 Sep 2026)**  
Work Engineering Platform — how we sit, what we bind, what we play back.  
Discussion paper. Not a Cursor ticket. Not a scrape-the-internet product.

Grounded in V10 canon (`V10_CLOSE.md`, `V10_BUILD.md`), live `work-engineering` on `main`, Scout v1 / AODP **source**, and McKinsey / Ontora / Atlan / Palantir / Dumas BPM.

A colleague “top 5%” draft was reviewed. This version **takes the craft that raises the bar** and **refuses the moves that look premium and are actually theatre**.

---

## 0. Why this paper exists

Our spec layer is unusually honest. Our **discovery experience is not**.

A CHRO who opens the product today meets: an empty function-head seat labelled stand-in, three canned playback rows, and a Plan line that was **seeded** (“This quarter: cut offer-to-Day-1 cycle time…”). Rashmi’s Offer Desk sheet is real. Everything above her is theatre-adjacent — labelled honestly, but still empty.

V10 is not “interview people and draw a swimlane.” V10 is: **intent → census → cut work into units → verify → refuse what we cannot defend.** Discovery that does not land in those objects is a chatbot with a glossary.

**Ask of the room:** lock the thesis, the three-seat jobs, the playback rule, and who sits first. Then we build.

---

## 0.4 Colleague “top 5%” draft — keep / reshape / kill

Absolute top % is **stricter**, not louder. McKinsey does not scrape Blind. Palantir does not show “72% confidence.” V10 does not invent “47 → 30 days.”

| Proposal | Verdict | Why |
|---|---|---|
| **Pain → permit** (last hire that broke → who owns it → can a helper do it → bind) | **KEEP** | McKinsey PEI + Dumas backward. This is the CHRO opening we were missing. |
| **First playback of their sentence as a draft strategy line** they can edit | **KEEP (reshape)** | Sit-close already Confirm/Correct. Show it **early**, from **their words only**. |
| **Playback as an editing surface** (strike-through → Correct) | **KEEP (reshape)** | Same as V10-8 Confirm/Correct. UX, not a new object. |
| **Pre-sitting homework** | **RESHAPE** | Top bar = Dumas **evidence before interview** on **materials they give**. Not OSINT. |
| Scrape careers / Glassdoor / Blind / LinkedIn / BuiltWith / CEO blogs | **KILL** | Same class as ATS→Work Unit: public **object** signals guessed into **process**. Creepy for a BNP-class CHRO. TOS. Invents “Greenhouse + Excel gap.” |
| “Cut 47 to 30 days” at minute 3 | **KILL** | Invented KPI. V10 forbids fake measured numbers. 95 / 61.8 stay Offer Desk’s two numbers, not a CHRO fiction. |
| LLM **72% confidence** badges | **KILL** | Fake precision. We already have honest statuses: seen in records / said by a person / pieced together / proposed / predicted. That **is** telemetry. |
| Import Scout v1 / AODP as **git dependencies** | **KILL (reshape)** | Merge by another name. **Port the invariants into WEP code** (one `?`, no `automat*`, quote both speakers, no mock fallback). |
| Re-open V10-1…14 as unbuilt | **KILL** | Those slices are **on main**. Discovery work sits **on top**. |
| Stage 4 “Delight” → 9.5/10 without a named human | **KILL** | Code cannot invent the eighth point. Real sitting first. |
| New `recon_hypotheses` + scraper as D-1 | **KILL** | Weeks of vendor-intel product. Does not bind a spec. |
| Mandatory recon | **KILL** | Empty start is allowed. “Skip scrape” should not exist because scrape should not exist. |
| Export **their** contract after bind (census download) | **KEEP** | Already V10 census pack. After sit-close, not a minute-3 brochure. |

**Bar sentence:** *If a CHRO cannot point at the sentence they typed, it does not go on the glass.*

---

## 0.5 Pre-sitting — their pack, not the web

**Thesis (Dumas, Palantir FDE):** do homework **on what they handed us**, then sit. Do not harvest the open web and call it understanding.

**In:** files they upload; a URL **they paste**; tenant tags already on Rashmi’s sitting.

**Out:** Glassdoor, Blind, LinkedIn crawl, BuiltWith, news scrapers, “12 engineering reqs therefore Offer Desk is the bottleneck.” Binding anything from public signal without a declared quote from a sitting or a file they own.

If they brought nothing: honest empty. CTA: “Start sitting” or “Attach a pack.” Not a dossier about their Glassdoor.

---

## 0.6 Value in the first minutes — without invention

The colleague is right that a CHRO will not wait 20 minutes for a report. They are wrong that we should **mint a fake contract** to hook them.

**Minute 0–3, honest:**

1. One question (pain-to-permit). They type.
2. We play **that sentence** back as a **draft this-period line**. Edit / confirm. If they have not said a number, **no number appears**.
3. Pack **hard anchors** shown as checkboxes (dual-employment etc.) — “these are on our HR pack; confirm or not.”
4. If they stop there: they have **their words** on a draft line. Census download still refuses invented hours.

That **is** McKinsey playback. It is not a PDF with 47 days we made up.

---

## 1. What V10 says discovery is

V10-1…14 and Mandate 1–4 are **already on `main`**. This paper does not re-open them.

Discovery succeeds only when a human sentence is stored, attributed, and bound to: strategy line, authority, acceptance, unliftable stop, or a pointer.

Census stays **six steps**. Discovery lives in **Capture** (three seats) + Playback + Sit close. Not a seventh step. Not a recon step on the census spine.

CHRO does **not** fill the 18-field unit. 95 stated / 61.8 defended stay two numbers. Dual-employment stays unliftable. Fake KPIs stay refused.

---

## 2. How the best actually discover (moves we steal)

| Who | Steal | Do not steal |
|---|---|---|
| **Dumas BPM** | Evidence then interview; forward vs backward; interviews miss exceptions | Week-long retreat; workshop as the wedge |
| **McKinsey** | Governing question; MECE tree; one story deep; playback; triangulate | $500k deck; invented benchmarks |
| **Ontora** | Knowledge lives in heads; async; “enough information” criteria | Interview everyone; voice agent day one; Box 4 execution agent |
| **Atlan** | “What does done mean **here**?” → acceptance quote | 80 connectors |
| **Palantir** | Objects + forbidden **actions**; concierge first | Firm-wide ontology; FDE army |
| **Celonis** | Logs = object traces | Map ATS stage → Work Unit |
| **Scout v1** | Narrative then sweep **holes**; pack `hard_anchors`; two speakers, quote both, fail closed | Mock fallback; canned typical pain; product merge |
| **AODP** | One question **enforced in code**; predict-and-validate; thought dump; no “what can we automate” | Interviewer/Analyser/Builder factory; import the repo |

WEP already has extract-from-story, next-questions, sit-close, strategy columns, five provenance statuses, census download. What we lack is **CHRO/Ops sitting craft wired to those objects**.

---

## 3. Thesis (lock)

> We do not mine logs into a process map.  
> We do not interview the company.  
> We do not scrape the internet and call it homework.  
> We sit **three altitudes** on **one journey**, store **verbatim**, **play back**, and **bind** only what a helper would need a permit for.  
> Empty is empty. Disagreement is kept. Stops are pack-backed, not invented.  
> How-we-know is a **status**, not a percentage.

If the room wants Ontora-for-HR or a company OSINT tool, that is a different company.

---

## 3.5 Differentiators that survive

1. **Pain-to-permit** — operational headache becomes authority / stop / acceptance, or it stays a story.
2. **Three altitudes, no mash** — CHRO ≠ Ops ≠ Rashmi. Playback quotes both sides.
3. **Binding only with a quote** — V10-8. CHRO sitting uses the same rule.
4. **Discrete how-we-know** — five statuses already on Evidence. Never 0.72.
5. **Pack hard anchors** — dual-employment in `handoff.py`, confirmed in sitting.
6. **Guardrails in our code** — port AODP/Scout **rules**. Do not vendor-import those repos.
7. **Honesty as the demo** — talk-only saves nothing; Spec denies without a file; 95 and 61.8 stay two numbers.

---

## 4. Experience flow (spine unchanged)

```
Home → Enterprise → HR → Offer Desk (worked example)
Census 1/6  SCOPE     Start. Readiness: consent / three people / docs.
Census 2/6  CAPTURE   Three seats (not a 7th step).
              Optional: attach their pack (existing Evidence), not a scrape.
              1. Function leader (CHRO)  — intent, pain-to-permit
              2. Sub-function lead (Ops) — trigger / end / systems
              3. SME (Rashmi)            — Tuesday
              Playback                   — three columns from stored text
              Sit close                  — V10-8 bind
Census 3–6  Evidence → Gap → Chart → Plan
Spec        Deny without evidence. Dual-employment unliftable.
```

**Rule:** no seventh census step, no Chart 18 rewrite, no merge of 95 and 61.8, no invented cycle-time.

### CHRO sitting (the gap)

1. **Pain-to-permit (one question):** *“Think of the last hire that went off the rails between offer and Day-1. What broke?”*
2. **So-what:** *“Who owns that? May a helper change it without a named human?”*
3. **Draft line from that answer only.** Confirm / correct (strike-through = Correct). No invented days.
4. **Sweep holes only:** this period, in/out, pack hard anchors, who may bind.
5. **One question at a time.** After each: “We heard: [verbatim]. Wrong?”
6. On confirm: write `strategy_intent_focus` / owner. **Stop seeding** the fixture sentence.

### Ops / SME / Playback

Ops: trigger / end / systems; predict-and-validate from **this tenant’s** tags.  
SME: keep Rashmi’s sheet; optional dump → extract-from-story → “is this you?” → sit-close.  
Playback: three columns from **storage**. Empty says empty. `PLAYBACK_ROWS` dies as source of truth once real text exists. Confirm/Correct is the editing surface — no new correction table.  
How-we-know: existing status words. Do **not** add `binding_confidence: 0.72`.

---

## 5. What gets written where

| They said | Lands in |
|---|---|
| CHRO this-year / pain sentence | Session text; `strategy_intent_focus` **after confirm** |
| Who may bind | `strategy_intent_owner` or sit-close authority |
| Pack stops confirmed | Display + confirm. Dual-employment stays `handoff.py` |
| Ops trigger / done | `work_systems` entry / exit |
| Ops systems | This tenant’s tags — not BuiltWith |
| SME Tuesday | Existing units + sheet + extract-from-story |
| Binding quotes | `field_ratifications` (V10-8) |
| Files they own | Pointers + catalogue |
| Invention in extract | Delinquency counters |

**No** `recon_hypotheses` table. **No** confidence float. **No** merge of scout-v1 or aodp.

---

## 6. CHRO issue tree

```
What is HR here to move this year?
├── This period’s bet          → strategy_intent_focus
├── In this census / out       → scope (reword f3; don’t delete)
├── What must stay human       → pack hard_anchors, confirmed
└── Who may put a rule on paper → owner / authority
```

**Entry ramp:** last broken hire → who owns the break → helper permit? → then the tree.  
**Not on this tree:** SLA minutes, Excel vs Zwayam, eleven steps, 18 attributes.  
CHRO = backward from the year (and the incident). SME = forward from Tuesday. We do not average disagreement.

---

## 7–9. Techniques, stages, whiteboard

World-class = the next question only they could answer. Pain-to-permit, their-pack first, narrative then hole-sweep, one question with a code backstop, predict-and-validate on this tenant, thought dump, triangulation, status not %.

**Stages:** 0 founders type (~5) → 1 named human (~7) → 2 client HRBP (~8) → 3 optional LLM with our guardrails. There is no Stage 4 that scores 9.5 from a scraper. **7 requires a named human.**

**We will not:** invent CHRO voice; seed strategy; ask CHRO offer steps; scrape the web; invent cycle-time; show LLM %; merge scout-v1/aodp; map ATS to 18 fields; add a seventh census step; touch Chart 18 or 95/61.8; lift dual-employment; silent mock; re-open V10-1…14.

---

## 10. Build slices (after lock) — on current `main`

| ID | Lead | What | Done when |
|---|---|---|---|
| **D-1** | Cursor | CHRO sitting v0: pain-to-permit, one question, draft line from **their** text, pack anchors as confirm, write strategy on confirm, empty CTA instead of stand-in theatre | Guest 1→6; Plan 95 and 61.8; no key; no invented days |
| **D-2** | Cursor | Playback from **storage**; Confirm/Correct (strike-through = Correct); empty columns empty | Constants not the source of truth |
| **D-3** | Claude | Port guardrail **rules** into WEP (one `?`, ban automation-framing, two-speaker quote, fail closed, no mock). Not a repo import | Tests |
| **D-4** | Cursor | Ops predict-and-validate from **this tenant’s** tags | Guest empty honest |
| **D-5** | Cursor | SME dump → existing extract-from-story → is this you? | Sit-close still quote-gated |

**Needle:** D-1 + D-2, then a **named sitting**.

---

## 11. Decisions for the room

1. We are Work Engineering, not Ontora-for-HR, not a scraper.
2. CHRO sitting is **intent + pain-to-permit**, never offer steps.
3. Playback constants die when real text exists.
4. Strategy line on Plan is confirmed sitting or “none yet.”
5. Pre-sitting = **their files / pasted URL they own**, optional. **No web harvest.**
6. First minutes = playback of **their** sentence. **No invented KPIs.**
7. How-we-know = **existing statuses**, not a %.
8. Confirm/Correct on **existing** sit-close/playback — no new correction table.
9. Port Scout/AODP **rules** into our code; do not import those repos.
10. First sitting is concierge. **Name:** ________ **Date:** ________
11. LLM interviewer out until Stage 1 is done.

If (10) is blank: still do D-1 + D-2. Do not start an agent or a scraper.

---

## 12. Paragraph you can say aloud

*We sit three people on one journey. We start the CHRO from the last hire that broke, not from offer steps. We play their sentence back as the draft of this period’s line — no numbers we did not hear. We confirm what must stay human from our pack, not from the internet. Ops tells us how the desk is supposed to run; Rashmi tells us Tuesday. We do not mash disagreement. We only bind what a helper would need a permit for, next to a quote. How we know it is a status you can read, not a fake percent. The census, the chart, and the hours we will defend sit downstream of that. That is discovery in Work Engineering. Everything else is a report — or a scrape.*

---

## 13. Honest scores (do not decorate)

| Lens | Now | After D-1+D-2 (no named CHRO) | After Stage 1 (named sitting) |
|---|---|---|---|
| CHRO sit | 2 | 5 | **7** |
| Playback | 4 | 6 | 7 |
| Discovery craft | 3 | 5 | 6 |
| Trust a file | 7 (already) | 7 | 8 if they attach a pack |
| Stay/pay | 1 | 2 | 5 only if they sat |
| Overall | ~3 | ~5 | **~7** |

**7 is the honest ceiling until a named human sits.** Treat any 9.5 path that starts with Glassdoor as a different paper.

---

*v1: 15 Sep 2026. v2: same day — colleague “top 5%” draft reviewed; scrape / 72% / invented KPIs / V10 reopen / repo-merge killed; pain-to-permit, early playback of their words, optional their-pack homework, status-not-percent kept.*
