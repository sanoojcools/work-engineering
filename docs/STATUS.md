# Product state — 5 September 2026

*(This file previously described the state as of 1 September 2026 — before V9's guided pitch walk (Home → Enterprise → HR → Offer Desk) merged to `main`. That version is superseded; nothing below should be read as consistent with an older copy of this file elsewhere. See `V8-STATE-AND-REFERENCE.md` for a fuller standalone snapshot and `V8-PRODUCTION-ENGINEERING.md` for how the product got from there to here.)*

Concept: [Work-Engineering-V8.md](Work-Engineering-V8.md) (now including Part K, Scout). Code mapping: [../ARCHITECTURE.md](../ARCHITECTURE.md). HTTP: [API.md](API.md). Honesty ledger: [HONESTY.md](HONESTY.md). How to run: [../README.md](../README.md). What's next, pending review: [ROADMAP-DECISIONS.md](ROADMAP-DECISIONS.md).

---

## In one sentence

Work Engineering is a specification layer (Work Units, VERDICT autonomy scoring, a GQS quality gate, five projections, a Spec API) fused with Scout, its capture layer (a CHRO blast-radius grid that scopes a census across a 44-sub-function HR catalog, structured three-layer interviews — Function Head, Sub-function Lead, SME — a live Work Capture Grid, five analytical elevations, LLM-optional extraction with an enforced verbatim guarantee) — one multi-tenant, Row-Level-Security-isolated product, demoable end to end with one click and no terminal step.

This repo remains the **specification layer** (V8 C4). It does not log an individual person in, connect to a real ERP, or execute work.

---

## Readiness

| Bar | Now | Meaning |
|---|---|---|
| **Colleague demo** | **Yes** | One click (**Set up the demo**) mints the key and signs the browser in. The 12-minute guided walk is now the front door: Home → Enterprise track → HR → Offer Desk SME → Playback → Spreadsheet → Save talk-only (proves persistence stays honestly empty) → How we cut it → Gap → Document check → Hours (declared 95 vs defended 61.8) → Spec deny → Sitting record. The older Overview → Discovery → Projections → VERDICT → Scout Interview walk still exists under Specification / Analysis in the nav, but it is no longer what a colleague is shown first. |
| **End-to-end (wedge)** | **Yes, and past J1** | One company × one function × inventory, graph, VERDICT, economics, gap, pack — plus the capture side (Scout) that produces that inventory from a structured interview, and the quality gate (GQS) that decides whether a genome is trustworthy enough to write. |
| **Multi-tenant, RLS-isolated** | **Yes, HTTP-proven** | Per-org `X-Spec-Key`, hashed at rest, rotatable with a grace window. Two-tenant cross-isolation proven by a real HTTP test matrix (`test_rls_http.py`), not a manual check. |
| **Customer-ready** | **Not yet** | The HR census is a sample employer's data. Scout captures real structured input from a real interview, but per-*user* login does not exist — only per-org keys. |
| **Ship-ready (hosted product)** | **Hosted and live, not yet customer-ready** | The Render free-tier blueprint (`render.yaml`) is deployed: `work-engineering-api` ran its Alembic migration against real Postgres and started clean (`Application startup complete`), health checks return `200` continuously; `work-engineering` (static frontend) built and deployed from the same commit. Confirmed via Render's own deploy/log API on commit `c963ab0` — not yet walked click-by-click in a browser against the hosted URL from this environment (outbound access here is proxy-restricted to an allowlist that doesn't include `onrender.com`). CI now exists (`.github/workflows/ci.yml`) — real Postgres-backed backend suite plus frontend typecheck/build on every push/PR. The PII-encryption key no longer has a hardcoded default — `PII_ENCRYPTION_KEY` is required, unset in any environment refuses to start. Still missing: monitoring, backup, a load test, and everything in tracks 4–6 of the enterprise-readiness roadmap. |

V8 alignment: **C3** (five projections of one record), **C4** (spec, not execution), **D1/D3** (Scout's declared-arm capture vs. discovered work; conformance gap), **E7** (provenance: observed vs. declared, honestly labelled throughout), **G6** (Spec checks logged; runtime *stopping* on denial is not built), **H2** (VERDICT + four hard gates, deterministic), **H5** (honest case: attributed hours are the smaller, defensible number), **Part K** (Scout as the concrete instrument for D1's downward, declared arm).

---

## What a colleague should see (12 minutes)

The front door is now Home, not Overview. Click **Set up the demo**, then:

1. **Enterprise track**: a company with HR, Finance, Legal, Operations listed — only HR is live; the rest are honest "not built" placeholders. Enter through HR operations at the Offer Desk.
2. **Offer Desk SME → Playback**: the three-seat model (CHRO / HR Ops stand-in, SME, and a 3-column playback of what each seat said), transcribed from a real interview.
3. **Spreadsheet → Save talk-only**: saving a talk-only session stays honestly empty — no GQS score, no fabricated genome — until real observed evidence backs it.
4. **How we cut it → Gap**: the conformance gap between what was declared in the interview and what the sitting record shows.
5. **Document check**: whether an evidence file actually backs a step, not just an assertion.
6. **Hours**: declared 95 hrs/month stays on screen next to the defended 61.8 — the smaller, evidence-backed number is not hidden behind the bigger declared one.
7. **Spec deny**: a live Spec API check against this Offer Desk work unit — evidence-free returns `denied, "evidence_ref required by contract"`; a real evidence_ref returns `allowed`.
8. **Sitting record**: the close of the 12-minute walk.

The pre-V9 walk (Overview → Discovery → Projections → VERDICT, then Scout Interview → the five elevations → Future Preview, then Sample Genome Co's ratify/drill/Automation-Index) still works and still lives in the nav under Specification / Analysis — it is just no longer the first thing a colleague is shown.

Do not treat any inferred VERDICT score, attributed FTE, or GQS score as more certain than the app itself states it to be. Do not demo `offer-desk-inputs/` as Rashmi's real production data — it is fabricated test evidence built to prove the observed-evidence path works end to end; see `offer-desk-inputs/README.md`.

---

## What is real right now (see `docs/HONESTY.md` for the full, continuously-updated ledger)

- Multi-tenant RLS isolation, per-org key rotation, server-computed file-hash upload, a deterministic (no-LLM) classifier and column mapper, partial genome ratification, the Automation Index's graph-edge detectors, consent receipts with a 90-day purge sweep.
- Consent is now a gate-enforced precondition for the live Scout path: generating a genome from a Scout session requires its `consent_receipt_id` to resolve to a real, active receipt for that tenant, or the whole batch is rejected (`missing_consent`/`invalid_consent`) — the generic JSON-body import stays permissive, since its `interview_id`/`consent_receipt_id` fields are free text a caller can set to anything, including the shipped sample genome's own decorative pre-consent-feature values.
- Scout: three-layer interview sessions (Function Head, Sub-function Lead, SME), a live Work Capture Grid, a completeness ("Genome Strength") meter, all five elevations with real (if simple) named mechanisms, LLM-optional extraction with an enforced verbatim-substring guarantee.
- CHRO blast-radius grid: a published 44-sub-function/6-cluster HR catalog, tenant-scoped in-scope/owner/priority selections, a live blast-radius meter, and a function-agnostic selector — HR is active and detailed, Finance/Legal/Sales/Operations are honest "not built" placeholders with no catalog or data behind them.
- Offer Desk worked example: 11 real steps, a handoff map, an exception catalog, and an automation-readiness summary, transcribed verbatim from a real interview. Its "Run this on the platform" action seeds them as a real Scout session — the completeness numbers that come back are the platform's own (verified: 84%, not the fabricated 100% a demo might reach for), not a copy of the source document's claims.
- Work Graph dependency-cycle detection: `POST /api/genome/import` now rejects a genome whose `dependencies[]` form a cycle (self-reference, mutual pair, or a longer ring), reporting the actual cycle path as a `circular_dependency` violation — the same pre-pass shape as the file-provenance and duplicate-code checks. GQS's own completeness check only validated that a dependency reference exists, never that the graph it forms is acyclic; this was a real, reachable gap (the shipped sample genome fixture had exactly this shape once — see below).
- Generating Work Units from a Scout session reuses the *same* import pipeline and faces the *same* GQS gate as any other genome — no relaxed path for the product's own capture instrument.
- V9's guided pitch walk (Home → Enterprise → HR → Offer Desk) is merged to `main` and closes end to end: three-seat interview + playback, talk-only save honestly stays empty, the cut/gap view, a document-backed evidence check, declared-vs-defended hours (95 vs 61.8), and a live Spec API deny → allow. `offer-desk-inputs/` is a **fabricated** evidence set (invented candidates, invented transcripts, invented system-of-record exports) built to prove that path works when observed evidence exists — not Rashmi's real production data, and not proof any real Zwayam/Zoho/UAN integration exists (there is none; the only real ingestion path is the generic `.csv`/`.xlsx` upload endpoint).
- `render.yaml`'s free-tier Render blueprint is deployed and live at `work-engineering-api.onrender.com` / `work-engineering.onrender.com` — migrations ran clean against real Postgres, both services are serving on commit `c963ab0`; see "Ship-ready" above for what's confirmed vs. not yet walked in a browser.

## What is not built, named precisely

A Function Pack SDK; adaptive, AI-generated interview follow-up questions (the question bank is static and hand-written); trace/log/ERP-based upward discovery (Scout captures declared intent only, and no Zwayam/Zoho/UAN connector exists); a dedup/split engine for malformed imports; a UI step that prompts a user to create a consent receipt before a Scout session starts (the API requires and checks one at genome-generation time — see below — but no screen guides anyone to create one first); per-user login or SSO; a real sub-function catalog for Finance, Legal, Sales, or Operations (the selector shows them as placeholders, not fabricated lists); automatic cascade from a CHRO's blast-radius selection into created interview sessions (Start interview pre-fills the create form — it does not create sessions on its own); a browser-confirmed hosted walk (the Render deploy is live and its migrations/health checks are confirmed via Render's API, but nobody has clicked through the actual 12-minute walk against the hosted URL yet). See `docs/Work-Engineering-V8.md` Part K11, `V8-PRODUCTION-ENGINEERING.md` §4, and `docs/ROADMAP-DECISIONS.md` for the full, evidenced list and what's proposed next.

## What not to promise

- That a passing GQS score means all fifteen of the original design's quality gates are individually enforced — most are partial or specified-only.
- That attributed FTE or an inferred VERDICT score is measured, confirmed labour.
- That a customer can log in and see only their own data — per-org keys exist; per-user login does not.
- That this product executes work, connects to a real ERP, or runs agents. It specifies work; execution systems consume the spec.
- That `offer-desk-inputs/` is Rashmi's real production month, or that any real Zwayam/Zoho/UAN system-of-record integration exists — both are fabricated test fixtures proving the observed-evidence path, not real data or a real connector.
