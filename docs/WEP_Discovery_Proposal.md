# WEP Discovery Proposal

**Work Engineering Platform — how we sit, what we bind, what we play back**  
Discussion paper for founders and colleagues. Not a Cursor ticket.  
Draft: 15 Sep 2026. Grounded in V10 canon, live `work-engineering` code, Scout v1 / AODP source, and how McKinsey / Ontora / Atlan / Palantir / BPM discovery actually work.

---

## 0. Why this paper exists

Our spec layer is unusually honest. Our **discovery experience is not**.

A CHRO who opens the product today meets: an empty function-head seat labelled stand-in, three canned playback rows, and a Plan line that was **seeded** (“This quarter: cut offer-to-Day-1 cycle time…”). Rashmi’s Offer Desk sheet is real. Everything above her is theatre-adjacent — labelled honestly, but still empty.

V10 is not “interview people and draw a swimlane.” V10 is: **intent → census → cut work into units → verify → refuse what we cannot defend.** Discovery that does not land in those objects is a chatbot with a glossary.

This paper proposes a high-bar discovery **experience** that:

1. Fits V10 (Boxes 2–3, three seats, sit-close, strategy intent, pointers, delinquency).
2. Learns from the best sitting practices in the market — without becoming Ontora, Atlan, or McKinsey.
3. Does not invent a CHRO’s voice.
4. Can be run concierge-first (we type with them) and productized later.

**Ask of colleagues:** lock the thesis, the three-seat jobs, the playback rule, and who sits first. Then we build.

---

## 1. What V10 says discovery is

From `docs/V10_CLOSE.md` and `docs/V10_BUILD.md` (platform canon, execution excluded):

| Canon block | What it demands of discovery |
|---|---|
| **Intent (3 levels)** | Function / work-system / **strategy**. Ratify. No silent guess. Unowned = dashed and counted. |
| **Discovery / pointers / EG-lite** | Declared (people) and observed (files) are different. Pointers must open. Binding fields need a **declared quote**. Extraction is a **performer** under VERDICT, not a free LLM. |
| **Work System + states** | A journey has entry, exit, owner. Objects (Offer, Employee) have named before/after. |
| **18-field unit** | The SME sitting fills the unit. The CHRO sitting does **not**. |
| **Chart / Gap / Plan** | 18 leaves of the hire; three gap tiers; 95 stated / 61.8 defended as two numbers. |
| **Sit-close (V10-8)** | Goal, authority, acceptance **beside their words**. Confirm or correct. |
| **Delinquency (V10-12)** | Invention / omission / distortion / flattery counted. Binding fields capped. |
| **Refuse** | Live execution, ATS→Work Unit mapping, lifting dual-employment, fake KPIs. |

**Implication:** discovery is successful only when a human sentence is stored, attributed, and bound to one of: strategy line, authority, acceptance, unliftable stop, or a pointer. A nice transcript that never writes those fields is waste.

Census walk stays **six steps** (Scope → Capture → Evidence → Gap → Chart → Plan). Discovery is **inside Capture** (three seats) plus **Playback** and **Sit close** on the Offer Desk path — not a seventh census step.

---

## 2. How the best in the market actually discover

We are not copying products. We are stealing **moves** that already match V10.

### 2.1 BPM (Dumas et al.) — three methods, not one

Process discovery is **gathering and organizing**, not drawing a model. Three classes:

| Method | Strength | Failure mode | WEP use |
|---|---|---|---|
| **Interview-based** | You get *why*, not only *what*. Forward (“what happens next?”) or backward (“what happens before this outcome?”). | Structured checklists make people hold back. Analysts retreat, model offline, come back weeks later to validate. | Our three seats **are** this — but playback must happen **in the same sitting**, not a week later. |
| **Evidence-based** | Documents, observation, event logs. Low burden on scarce experts. | Logs are **object states** (Candidate in Stage 3), not process definitions (Verify dual employment). Models from logs are often unreadable. | Files + pointers (V10-2/10). Never map ATS rows to Work Units. |
| **Workshop-based** | Shared language in the room. | Expensive; dominant voices win. | Optional later. Not the wedge. |

Dumas’ interview loop is: interview → retreat → model → validate. That loop is why discovery “eats the timeline.” **WEP’s bet:** extract + playback + bind **in one sitting**, so the retreat is software, not a consultant’s weekend.

Interviews are biased to **happy path**. We must ask exceptions on purpose (dual-employment, two owners, no finish) — those are V10 Gap / admissibility, not colour.

### 2.2 McKinsey — structure, probe, playback, triangulate

Not the $500k deck. The **sitting craft**:

- **Clarify the governing question first.** For a CHRO that is not “walk me through offer steps.” It is: *what is HR here to move this year, and what must never be automated away?*
- **Issue tree, MECE.** CHRO tree is small: this-period bet / in-or-out / unliftable human / who may bind. Ops tree: trigger → done, systems, owners. SME tree: Tuesday steps, evidence, pain.
- **Open questions** (“what / how / why”), not “can / does.”
- **PEI-style depth, not survey breadth.** One story, many probes — not 13 boxes. AODP independently learned “one question per turn” and then **enforced it in TypeScript** because the model cheated.
- **Playback as the product.** “Did I hear you right?” before the next branch. Synthesis is scored; a sitting without playback is incomplete.
- **Triangulation.** Same topic, three altitudes. Disagreement is signal. McKinsey does not average the CHRO and the clerk.

**WEP mapping:** three seats = triangulation. Sit-close = playback of binding lines. Strategy intent = the governing question, ratified.

### 2.3 Ontora — speed and coverage; different job

Ontora (YC): AI agents interview **every employee in parallel**, 4 hours vs 4 months, produce process maps + a **context layer for other agents**, plus an automation roadmap. Campaign brief → async interviews → McKinsey-shaped report → chat over the corpus.

**Steal:**

- Discovery that never leaves people’s heads is the bottleneck.
- Async / micro-burst (AODP already: pause/resume).
- Campaign has **success criteria** for “enough information” — same idea as our census readiness strip (consent / three seats / docs).

**Do not steal:**

- Interview **every** employee. Our wedge is **three named seats** on one journey (offer → Day-1). Breadth without binding is a report, not a spec.
- Voice agent as day-one UX for a CHRO. Palantir’s lesson: concierge first.
- “Then we ship the agent that closes the gap.” That is Box 4. V10 puts execution **outside** the platform. Spec is the wall.
- Automation-ROI roadmap as the CHRO artefact. Our artefact is: **what we will defend, what we refuse, 95 vs 61.8.**

Ontora answers “how does work actually get done, everywhere?”  
WEP answers “what is the contract of this journey, and what may a helper never do?”

Complementary. Not a merge. Not a partnership required for the wedge.

### 2.4 Atlan — meaning is the product

Atlan: catalog (inventory) vs **glossary** (what “client” means *here*) vs **context layer** (that meaning, enforced at runtime for humans and agents). Glossary without lineage is a wiki. Lineage without glossary is a graph nobody trusts.

**Steal:**

- “What does **done** mean on this desk?” is a glossary act. It becomes `acceptance_criteria` with a quote (V10-8).
- Owners on terms. Unowned = dashed (we already count `intent_debt`).
- Context for any later helper: performer handoff **withholds scores** (V10-14) and still carries gates. That is Atlan’s “context layer,” thin, on purpose.

**Do not steal:** 80 connectors, 18 million assets, marketplace. We have one journey and three objects (Employee, Offer, Contractor).

### 2.5 Palantir — ontology of decisions, concierge

Foundry ontology: **object types, properties, links, action types**. Nouns (Offer, Employee) plus verbs (what you are allowed to do to them). Ontology models **decisions**, not tables. Forward-deployed engineers sit with the operator until the objects are right.

**Steal:**

- Objects first: Offer / Employee / Contractor already on the walk. Discovery should name **states** (before/after) in their words — V10-11.
- **Action types ≈ Spec:** what a helper may do. Dual-employment is a forbidden action, in code (`handoff.py`), not a prompt.
- Concierge until the first real sitting exists.

**Do not steal:** full enterprise graph, AIP actions in production, 12-person FDE teams.

### 2.6 Celonis — logs are not processes

Process mining is gold for **throughput on instrumented paths**. It is poison if you treat an ATS stage column as a Work Unit. We already locked: ATS row = object instance; Work Unit = process definition. Discovery must keep that split on the glass so a CHRO does not think we “read Workday and found 11 steps.”

### 2.7 Our own prior art (code, not slides)

**Scout v1** (`interview_engine.py`, `context_packs.py`, `conflict_detector.py`):

- Narrative pass (“walk me through a normal day”) then **sweep only uncovered pack holes**.
- `hard_anchors` / `forbidden` live on the **pack**, not invented per chat.
- Conflict = two **different** people, confirmed text, **quote both sides**, fail closed if the model is down.
- **Do not copy:** silent mock fallback when Claude fails; canned `typical_pain_points`; one-automation product.

**AODP** (`agents/interviewer.md`, `interviewGuardrails.ts`, `wasteHeuristics.ts`):

- One question per turn; never foreshadow; never “what can we automate.”
- Predict-and-validate: “In this ATS you usually search by req id or name — which, or other?”
- Thought dump → bullets → yes/no.
- Phase 1 = role, **trigger**, **end**. Skip what is already known.
- Drop colleague names; keep role + delay.
- Expand org lingo once (`SPOC`).
- **Prompts failed.** They put the rules in TypeScript (count of `?`, ban `automat*`, force JSON schema on close).
- Waste heuristics in **code** (duplicate entry, dead-end data, loops) — LLM was unauditable.

WEP already has extract-from-story, next-questions, sit-close, strategy columns. What we lack is **this sitting craft wired to those objects**.

---

## 3. The WEP discovery thesis (lock this)

> We do not mine logs into a process map.  
> We do not interview the company.  
> We sit **three altitudes** on **one journey**, store **verbatim**, **play back**, and **bind** only what a helper would need a permit for.  
> Empty is empty. Disagreement is kept. Stops are pack-backed, not invented.

That is the product difference:

| Others | WEP |
|---|---|
| Ontora: many people → context for agents | Three seats → **spec** (what may run, what must not) |
| McKinsey: insight → slide | Insight → **ratified field** next to the quote |
| Atlan: term → catalog | Term → **acceptance / authority** on a Work Unit |
| Palantir: ontology of the firm | Ontology of **this hire journey** (thin, honest) |
| Celonis: frequency from logs | Hours we will **defend** vs hours **stated** (95 / 61.8) |

If colleagues want “Ontora for HR,” that is a different company. This paper assumes we stay Work Engineering.

---

## 4. Experience flow (tight to V10)

The guest/CHRO walk does not change its **spine**. Discovery changes what happens **inside** the seats.

```
Home
  → Enterprise → HR → (Offer Desk as the worked example)
Census 1/6  SCOPE     Start census. Readiness: consent / three people / docs.
Census 2/6  CAPTURE   Three seats live here (not a 7th step).
              1. Function leader (CHRO)     ← intent sitting (this paper)
              2. Sub-function lead (Ops)
              3. SME (Rashmi)
              Playback                      ← triangulation (this paper)
              Sit close                     ← V10-8 bind
              Sheet / talk-only / evidence  ← already honest
Census 3/6  EVIDENCE  Pointers; connected / not.
Census 4/6  GAP       Declared vs observed; refusals; risks already computed.
Census 5/6  CHART     18 leaves; careful / as calculated / ambitious.
Census 6/6  PLAN      This-period line FROM THE CHRO SITTING; 95 and 61.8;
                      unowned lines; download census.
Spec                 Deny without evidence. Dual-employment unliftable.
```

**Rule:** nothing from discovery may add a seventh census step, rewrite Chart’s 18, or merge 95 and 61.8.

### Moment-by-moment (what they should feel)

**Scope.** “We are taking a census of offer → Day-1, not of all HR.” Readiness red until three seats exist is **honest**, not broken — once CHRO/Ops can actually sit.

**Capture — CHRO (new craft).**  
Not a stand-in wall. Not offer steps.

1. One narrative prompt (McKinsey governing question / Scout layer 1).  
2. Sweep only empty holes from a **CHRO track** (this period already said? skip. Unliftable not confirmed? ask. Who binds? ask).  
3. After each answer: one-line playback. “We heard: … That becomes this period’s line. Wrong?”  
4. Hard anchors from **the HR pack** listed as checkboxes they confirm — Scout, not an LLM stop-factory.  
5. Stored as their text on the `function_head` session. **Also written** to `strategy_intent_focus` / owner when they confirm. Stop seeding the fixture sentence.

**Capture — Ops.**  
AODP Phase 1: trigger / end / systems. Predict-and-validate using **this tenant’s** tags (Zwayam, Zoho, Excel from Rashmi), never generic NetSuite. Roles not names.

**Capture — SME.**  
Keep the sheet. Optional thought dump → existing `extract-from-story` → “is this you?” → sit-close. Facilitator strip stays pack-verbatim for empty **binding** fields (authority / acceptance / desired), seat-locked — that code is correct for SME, wrong as the CHRO’s only prompt.

**Playback.**  
Three columns from **stored text**. Same topics: this period / in-out / stop / who binds / systems. CHRO vs Ops vs Rashmi. Do not vote. Scout conflict rules: two speakers, quotes, no mash. If a column is empty, it says empty — not `PLAYBACK_ROWS`.

**Sit close.**  
Already V10-8. Goal / authority / acceptance beside quotes. Confirm/Correct only when a quote exists. CHRO’s sit-close is **intent lines**, not 18 fields. SME’s is the three binding lines. Hide the other 15 (Mandate 3 — already the rule).

**Evidence / Gap / Chart / Plan.**  
Unchanged spine. Plan’s “this period” row **reads the ratified strategy intent**, not a constant. Chart still 18 leaves. Gap still does not call GQS-fail a “compliance risk.”

---

## 5. What gets written where (so we don’t hallucinate a new stack)

| They said | Lands in (already exists unless noted) |
|---|---|
| CHRO this-year sentence | `work_systems.strategy_intent_focus` after confirm; session transcript |
| CHRO names who binds | `strategy_intent_owner` or sit-close authority |
| CHRO confirms pack stops | Not a new stop table. Dual-employment stays `handoff.py`. Pack `hard_anchors` is **display + confirm**, like Scout |
| Ops trigger / done | `work_systems` entry / exit (already on the row) |
| Ops systems | Session units / tags; later `shared_company_context_tags` analogue — **do not** invent a new graph DB |
| SME steps + times | Existing Scout units + Offer Desk sheet; extract-from-story chunks |
| Binding quotes | `field_ratifications` (V10-8) |
| Disagreement | Playback from session text; Contradiction Resolver already exists head-vs-doer |
| Files | Pointers + catalogue (V10-2/10) |
| Invention in extract | Delinquency counters (V10-12) |

No new agent runtime. No merge of `scout-v1` or `aodp`. No seventh step.

---

## 6. The CHRO issue tree (high bar, small)

McKinsey would not give a CHRO thirteen Work-Unit questions. Four branches, MECE, all **intent**:

```
What is HR here to move this year?
├── This period’s bet          → strategy_intent_focus
├── In this census / out       → scope (blast radius) — reword f3, don’t delete it
├── What must stay human       → confirm pack hard_anchors (dual-employment etc.)
└── Who may put a rule on paper → owner / authority
```

**Not on this tree:** SLA minutes, Excel vs Zwayam, eleven steps, 18 attributes. Those are Ops/SME.

So-what after the bet: *“So we will judge Offer Desk by cycle time this quarter, not by headcount — and dual-employment still cannot be waived. Is that the contract?”*  
If they say no, we **correct**, we do not average.

Forward vs backward: CHRO is **backward from the year** (“what must be true by December?”). SME is **forward from Tuesday** (“what happens when a recruiter asks?”). Mixing them is why the old questions felt wrong.

---

## 7. Imaginative vs “globally known settings”

World-class discovery is not more questions. It is **the next question only they could answer**.

| Technique | Source | How we use it |
|---|---|---|
| Narrative then hole-sweep | Scout v1 | CHRO |
| One question + code backstop | AODP guardrails | If/when LLM talks; even the typed UI asks one at a time |
| Predict-and-validate | AODP | Ops systems, tenant tags |
| Thought dump → confirm | AODP | SME + extract-from-story |
| Backward interview | Dumas | CHRO from year-end; “what happens before ‘hire complete’?” |
| Triangulation | McKinsey | Playback three columns |
| Meaning | Atlan | “What does done mean **here**?” → acceptance quote |
| Objects + forbidden actions | Palantir | Offer/Employee states; dual-employment as action veto |
| Evidence-based, separate | Dumas / Celonis | Files as observed; never as the process |

**Imagination we refuse:** peer percentiles, “typical CHRO,” mock fill when the model is down, LLM-invented stops, ATS stage → `current_condition`.

---

## 8. Concierge → product (do not skip)

| Stage | Who | Software | Honest score |
|---|---|---|---|
| **0** | Founders type a CHRO sitting (Raja or a friendly CHRO) | Typed seat, playback from storage, Plan line from storage | ~5 — honest, still not “their” CHRO |
| **1** | Named human, 20 min, we facilitate | Same objects | ~7 |
| **2** | Client HRBP runs CHRO seat; SME self-serves sit-close | Facilitator + one-question + extract confirm | ~8 if Stage 1 quotes exist |
| **3** | Optional LLM interviewer | Only with AODP-style **code** guardrails; never Scout mock fallback | Optional |

Stage 3 without 0–1 will produce SurveyMonkey. Colleagues who want an agent now are asking for Ontora’s product, not V10’s.

---

## 9. What we will not do (write this on the whiteboard)

- Invent CHRO quotes or “stand-in voice” beyond the current labelled empty.  
- Ask CHRO offer-step questions (`s1` stays SME).  
- Keep `PLAYBACK_ROWS` as source of truth once a sitting exists.  
- Seed `strategy_intent_focus` as if it were discovered.  
- Merge `sanoojcools/scout-v1` or `sanoojcools/aodp`.  
- Build Interviewer / Analyser / Builder agents.  
- Map tracker columns to 18 fields.  
- Call GQS-fail or talk-only a compliance risk.  
- Add a seventh census step.  
- Touch Chart 18-count, 95/61.8 as two numbers, dual-employment lift.  
- Silent mock on model failure.

---

## 10. Build slices (only after this paper is locked)

Order is experience, not factory leftover.

1. **CHRO sitting v0** — narrative + sweep on existing `function_head`; CTA instead of empty theatre; write strategy intent on confirm.  
2. **Playback from storage** — three columns from session/sit-close text; empty stays empty.  
3. **Ops predict-and-validate** — systems from this tenant.  
4. **SME dump → extract-from-story → is this you?**  
5. **Pack `hard_anchors`** surfaced to CHRO as confirm, dual-employment unchanged in handoff.  
6. **Optional LLM interviewer** with copied AODP guardrails — only after a real human has sat.

Slices 1–2 move the CHRO score. 3–5 make Capture a product. 6 is not the wedge.

---

## 11. Decisions for the room

Please mark yes / no / later:

1. We are **Work Engineering**, not Ontora-for-HR. Discovery exists to **bind a spec**, not to interview the company.  
2. CHRO sitting is **intent only** (the four-branch tree).  
3. Playback constants **die** as soon as any real text exists, even if the walk looks thinner.  
4. Strategy line on Plan is **only** from a confirmed sitting (or explicitly “none yet”).  
5. First sitting is **concierge** (Stage 0–1). Name: ________  Date: ________  
6. LLM interviewer is **out** until Stage 1 is done.  
7. We will not merge Scout v1 or AODP; we will steal the **moves** listed above.

If (5) is blank, we still do slices 1–2 (typed seat + honest playback). We do not start an agent to fill the hole.

---

## 12. One paragraph you can say aloud

*We sit three people on one journey: the CHRO for this year’s bet and what must stay human, the ops lead for how the desk is supposed to run, Rashmi for Tuesday. We ask one thing at a time, play their words back, and only then write the contract — who may bind, what “done” means, what a helper may never do. We do not invent their voice, we do not turn their ATS into a process, and we do not average disagreement. The census, the chart, and the hours we will defend are downstream of that sitting. That is discovery in Work Engineering. Everything else is a report.*

---

*Sources for the market section: Dumas et al., Fundamentals of BPM (interview / evidence / workshop; forward vs backward); McKinsey problem-solving & PEI (issue tree, open questions, deep probe, synthesis); Ontora public product (YC, ontora.com — parallel employee interviews → context layer for agents); Atlan (glossary vs catalog vs context layer); Palantir Foundry ontology (objects, links, actions); Celonis-class process mining (event logs as object traces); Scout v1 and AODP source in `sanoojcools/scout-v1` and `sanoojcools/aodp` as scanned 15 Sep 2026; V10_BUILD.md / V10_CLOSE.md on `work-engineering` main.*
