# Product state — 1 September 2026

*(This file previously described the state as of 25 August 2026 — before Scout, before multi-tenant per-org auth, before Alembic. That version is superseded; nothing below should be read as consistent with an older copy of this file elsewhere. See `V8-STATE-AND-REFERENCE.md` for a fuller standalone snapshot and `V8-PRODUCTION-ENGINEERING.md` for how the product got from there to here.)*

Concept: [Work-Engineering-V8.md](Work-Engineering-V8.md) (now including Part K, Scout). Code mapping: [../ARCHITECTURE.md](../ARCHITECTURE.md). HTTP: [API.md](API.md). Honesty ledger: [HONESTY.md](HONESTY.md). How to run: [../README.md](../README.md).

---

## In one sentence

Work Engineering is a specification layer (Work Units, VERDICT autonomy scoring, a GQS quality gate, five projections, a Spec API) fused with Scout, its capture layer (structured founder/SME interviews, a live Work Capture Grid, five analytical elevations, LLM-optional extraction with an enforced verbatim guarantee) — one multi-tenant, Row-Level-Security-isolated product, demoable end to end with one click and no terminal step.

This repo remains the **specification layer** (V8 C4). It does not log an individual person in, connect to a real ERP, or execute work.

---

## Readiness

| Bar | Now | Meaning |
|---|---|---|
| **Colleague demo** | **Yes** | One-click setup on Overview seeds both demo tenants, mints their keys, and signs the browser in. Walk Client A's HR census through Discovery → Projections → VERDICT, then Scout Interview → the five elevations → Future Preview, then switch to Sample Genome Co and ratify/drill/Automation-Index a document-backed genome. |
| **End-to-end (wedge)** | **Yes, and past J1** | One company × one function × inventory, graph, VERDICT, economics, gap, pack — plus the capture side (Scout) that produces that inventory from a structured interview, and the quality gate (GQS) that decides whether a genome is trustworthy enough to write. |
| **Multi-tenant, RLS-isolated** | **Yes, HTTP-proven** | Per-org `X-Spec-Key`, hashed at rest, rotatable with a grace window. Two-tenant cross-isolation proven by a real HTTP test matrix (`test_rls_http.py`), not a manual check. |
| **Customer-ready** | **Not yet** | The HR census is a sample employer's data. Scout captures real structured input from a real interview, but per-*user* login does not exist — only per-org keys. |
| **Ship-ready (hosted product)** | **Not yet** | No CI exists anywhere in this project's history (a real, load-bearing gap — see `V8-PRODUCTION-ENGINEERING.md` §4.1). A hardcoded PII-encryption-key default (`dev-pii-key-change-me`) mirrors a class of risk already fixed once for the legacy spec key, unaudited in this one corner. |

V8 alignment: **C3** (five projections of one record), **C4** (spec, not execution), **D1/D3** (Scout's declared-arm capture vs. discovered work; conformance gap), **E7** (provenance: observed vs. declared, honestly labelled throughout), **G6** (Spec checks logged; runtime *stopping* on denial is not built), **H2** (VERDICT + four hard gates, deterministic), **H5** (honest case: attributed hours are the smaller, defensible number), **Part K** (Scout as the concrete instrument for D1's downward, declared arm).

---

## What a colleague should see (10 minutes)

1. Open the app. Click **Set up the demo** on Overview — one click, no terminal, no copy-pasted keys.
2. Overview: real numbers for Client A (work units, VERDICT L4+ drafts, attributed hours, FTE) — banner states plainly that VERDICT and hours are drafts until confirmed.
3. Work Units → Discovery → Projections → VERDICT: the specified, verifiable inventory (V8's C-through-H core).
4. Scout Interview: start a session, load the sample rows (or type your own), watch the Genome Strength meter climb, tour the five elevations, try Story to Structure against a live model if `LLM_PROVIDER=anthropic` is configured.
5. Future Preview → Generate V8 Work Units: watch it score low and get blocked — a Scout-only genome is *structurally* capped under GQS's 90-point gate (declared, not observed, provenance), stated as the intended behaviour, not a bug.
6. Switch to Sample Genome Co (one click from the sidebar). Open its genome: ratify, drill business objects → work units → full 18-attribute detail, read the Automation Index.

Do not treat any inferred VERDICT score, attributed FTE, or GQS score as more certain than the app itself states it to be.

---

## What is real right now (see `docs/HONESTY.md` for the full, continuously-updated ledger)

- Multi-tenant RLS isolation, per-org key rotation, server-computed file-hash upload, a deterministic (no-LLM) classifier and column mapper, partial genome ratification, the Automation Index's graph-edge detectors, consent receipts with a 90-day purge sweep.
- Scout: founder/SME interview sessions, a live Work Capture Grid, a completeness ("Genome Strength") meter, all five elevations with real (if simple) named mechanisms, LLM-optional extraction with an enforced verbatim-substring guarantee.
- Generating Work Units from a Scout session reuses the *same* import pipeline and faces the *same* GQS gate as any other genome — no relaxed path for the product's own capture instrument.

## What is not built, named precisely

A Function Pack SDK; adaptive, AI-generated interview follow-up questions (the question bank is static and hand-written); trace/log/ERP-based upward discovery (Scout captures declared intent only); a dedup/split engine for malformed imports; cycle detection on the Work Graph's dependency edges; consent as a required, gate-enforced precondition of capture; per-user login; CI of any kind. See `docs/Work-Engineering-V8.md` Part K11 and `V8-PRODUCTION-ENGINEERING.md` §4 for the full, evidenced list.

## What not to promise

- That a passing GQS score means all fifteen of the original design's quality gates are individually enforced — most are partial or specified-only.
- That attributed FTE or an inferred VERDICT score is measured, confirmed labour.
- That a customer can log in and see only their own data — per-org keys exist; per-user login does not.
- That this product executes work, connects to a real ERP, or runs agents. It specifies work; execution systems consume the spec.
