# Scout Enhanced Vision (corrected)
Date: 2026-08-26 | Branch: feat/genome-import-foundation | Tests: 28/28 | GQS: 40 blocked vs 94.29 pass | Source-of-Truth Hierarchy: V8 FULL > services/verdict.py > Master Build Plan v0.4 + patches > 5 HR Excels (sample only)

**Correction note (this revision):** one factual claim in the Moat section was wrong (the legacy spec key was not removed). Everything else here is pitch narrative / target vision, not a claim about current code — labeled explicitly below as **Vision** vs **Current, Verified** so Grok/meta.ai don't read aspirational pitch lines as implementation status. See `Scout-State.md` and `Scout-Reference.md` for what's actually built.

## Source-of-Truth Hierarchy (if conflict, trust higher)
1. Work-Engineering-V8-Detailed-FULL.md
2. Existing live code `services/verdict.py` — correctly implements L1–L6 + 4 gates — KEEP as truth, do not invent thresholds or a 5th gate
3. Master Build Plan v0.4 + Critical Evaluation + AMBITIOUS_IMPORT_PATH_v0.6 + CONTINUE_AMBITIOUS_IMPORT_v0.6.1
4. 5 HR time-motion Excels — sample only, org-agnostic; the sample uses a fictional company name only, nothing in code hardcodes it

Rules: no org name hardcoding, no real PII, no invented thresholds/formulas, no extra fields beyond the 18 attrs, mark provenance Observed/Declared/Inferred/Designed, versioning v1 Inferred / v2 Detailed / v3 Ratified + semantic diff (diff engine is Vision, not built — see Reference doc).

## Vision — What Scout Is (target design)

Scout is a discovery engine that turns Observed reality (interviews + bulk docs + time-motion studies) into a Private Genome — Work Units with an 18-attribute contract, VERDICT autonomy scoring, Thompson-typed Work Graph edges, and Observed/Declared/Inferred/Designed provenance.

Scout does not run work. WEP (Work Engineering Platform) is the specification layer between enterprise intent and execution — machine-readable, verifiable, allocatable. Execution systems consume the spec via a Spec API.

Primitive: a Work Unit is an independently accountable commitment to move one business object from a current condition to a desired condition, with an 18-attribute contract. Granularity is set by accountability and verifiability, not size.

**Current, Verified**: the 18-attribute contract, VERDICT scoring, and one edge type (Sequence) of the Work Graph exist and are proven for the JSON-body import path. Interview capture, bulk-doc ingestion, and the other 3 Work Graph edge types are Vision only — see `Scout-Reference.md` for the exact split.

## Why Now — V8 B1–B5 (unchanged, this is V8's own argument, not a claim about our code)

Organizations meet five demands at once; AI changes the supply of exactly one (intelligence). The bundle breaking, not any single demand, is what's new. Adding intelligence without redesigning the other four (coordination, verification, authority, accountability) produces more output and less assurance. Every existing representation (BPMN, ArchiMate, etc.) misses the accountability layer. The open question is what representation of work stays stable while actors change — V8's answer is the Work Unit.

## What Scout Is Not (Vision — positioning, not a build claim)

- Not process mining — process mining shows flow; Scout aims to show accountability + verifiability + provenance.
- Not "just an LLM + Excel parser" — the intended moat is the Enforcement Gateway + Pack flywheel + GQS, not the parser alone. **Note: the parser itself doesn't exist yet, so this positioning can't be demonstrated until Parser v2 is built — see Reference doc.**
- Not surveillance — intended to be consent-based, DPDP Act 2023 aligned, with transcript auto-purge and a notes-only option. **None of the consent/purge mechanism is built yet** (the `consent_receipts` table exists but nothing writes to it, and there is no purge cron).
- Not running work — spec only; execution consumes via a Spec API with `X-Spec-Key` enforcement. **Currently true only for the new genome-import router; every other existing endpoint still uses the old global key.**

## Success Criteria (target, with current status noted)

WEP consuming ScoutAPI JSON without re-interviewing: **not yet possible** — no interview capture exists to re-interview *from*. Zero orphan WUs: **true for anything that clears the GQS gate**, by score arithmetic, not by a separate FK check. 100% 18-attr completeness, no nulls: **enforced for each Work Unit by Pydantic**, at the field level described above. GQS>90 gate blocking import: **live and proven** (40 vs 94.29). 85%+ Observed provenance, file fingerprint sha256: the fixtures used to prove GQS demonstrate this on paper, but **no file upload path computes a real sha256** — any hash in provenance today is caller-supplied.

## Function Pack Abstraction — Moat Foundation (Vision, not built)

The idea: the same engine works for HR Ops, Finance Ops, etc. by loading a different pack (ontology + question bank + regulatory stubs + parser hints + verdict anchors). **No Function Pack SDK exists in the repo** — no `pack.json`, no loader, no CLI. This entire section is target design.

## Moat — For VC (corrected)

1. Spec system of record with Enforcement Gateway (V8 G6): execution must present a Spec Key + authority + evidence + object state, denied without a token. **True for the genome-import router only.** Per-org key hash + audit log is real for that router; key rotation is not built. **The old hardcoded `dev-spec-key-change-me` global key was NOT removed** — it's still the default and still used by every other existing router (`work_units`, `spec`, `census`). This is real follow-up work, not done.
2. Pack flywheel: **Vision, not built** — no packs exist yet, so there's nothing to reuse across functions.
3. GQS: weighted formula, code-enforceable, blocking import if <90. **This one is real** — proven with actual runs, 40 vs 94.29.
4. Provenance + tamper-evident audit trail: audit logging is real but partial (import attempt/commit only — not ratify, not reads). RLS tenant isolation is real and proven via HTTP (Org A 200, Org B 404).

**Honest VC pitch line, given the above**: "Scout's foundation — verifiable multi-tenant storage, a quality gate that blocks bad data with a real score, and field-level PII encryption — is built and tested. The discovery engine that turns raw interviews and spreadsheets into that verified genome automatically is the next build phase, not yet started." The stronger pitch line in the original doc ("7 days vs 90 days consulting, 85%+ Observed") describes the target outcome once Parser v2 and interview capture exist — it is not yet demonstrable.

## Wedge — Why HR Ops First (Vision — reasoning is sound, nothing here claims current build status)

High volume, clear ROI framing, low system-integration risk, but high PII sensitivity — the argument is that solving PII encryption + consent + RLS + redaction early for the hardest function becomes reusable moat for easier functions later. This reasoning holds regardless of build status; noting only that the PII/RLS pieces it refers to as "already solved" are indeed the real, tested parts of this session's work — the consent piece specifically is not.

**CHRO pitch line, corrected**: "Scout's tenant isolation and PII encryption are real, tested with two organizations and real email/UAN-shaped text encrypted and decrypted correctly. The consent-receipt and 90-day auto-purge promise in this pitch is not yet built — don't commit to that specific claim with a CHRO until it exists."

## Rules — No Hallucination (unchanged, these rules are still exactly what's being followed)

- No org name hardcoding anywhere.
- No real PII — Person A/B, fake emails, UAN `XXXX-XXXX-XXXX-XXXX`.
- No invented thresholds — V8 Annexure C only publishes 1/3/5 anchors, 2/4 are explicitly marked interpolation, no invented numeric mean→level formula.
- No extra fields beyond the 18 attrs on a Work Unit — enforced by `WorkUnitImport`'s `extra="forbid"` (the container itself is intentionally permissive — see Reference doc for why).
- Exactly 4 hard gates per V8 H2 + `services/verdict.py` — no 5th gate.
- Provenance structured where it's actually validated (`source_type` only, today) — the rest of the structured shape is accepted but not yet enforced or computed.
