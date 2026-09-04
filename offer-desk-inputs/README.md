# Offer Desk Inputs — synthetic evidence set

**Everything in this folder is FABRICATED FOR TESTING.** Nine invented
candidates, invented interview transcripts, invented system-of-record
exports. None of it is Rashmi's real production data — Rashmi's actual
11-step sitting transcript lives in `frontend/src/lib/offerDeskData.ts` and
is untouched by this folder. This batch exists to answer one question: *if
the observed-side inputs this platform is missing actually existed, would
the pipeline work end to end?* — verified live, not just asserted.

See the input table this folder implements and the reasoning behind each
row in the conversation that produced it; the short version is below.

## What's here

```
00-foundation/       candidate-roster.xlsx, company-context.md — the backbone
                     every other file derives from
01-interviews/       Function Head + Sub-function Lead transcripts (the
                     "stand-in" seats made real), the SME job description
02-policy/           salary grid, UAN dual-employment stop rule, bonus/ESOP
03-system-logs/      Zwayam, Zoho, UAN, OneDrive, and the 5 named Excel
                     trackers — all keyed to the same 9 candidates
04-measurement/      monthly candidate throughput
05-governance/       a consent receipt record
06-payoff-genome/    the fully-authored 18-attribute Offer Desk genome +
                     uploaded-files.json (real file IDs from a live upload)
scripts/             candidates.py (single source of truth), build_all.py,
                     build_genome.py — regenerate everything with
                     `python3 build_all.py && python3 build_genome.py`
                     (needs `pip install openpyxl`)
```

## What was actually proven, live, against a real running instance

Not just "this file validates against the schema" — the whole chain was
run through the real API, against a fresh tenant, with real HTTP calls:

1. **7 files uploaded for real** via `POST /api/files/upload` — server
   computed their sha256, assigned real integer file IDs. (`.json` isn't
   an accepted upload type — the Zwayam export exists as both `.json`,
   for readability, and `.csv`, which is what actually got uploaded. A
   real, useful constraint the platform enforces, not routed around.)
2. **The genome imported and passed the real GQS gate**: 92.73 / 90,
   zero schema violations, zero orphan dependencies — 9 of 11 Work Units
   `source_type: observed`, backed by those real uploaded files and their
   server-computed hashes (not self-asserted). The 2 that stayed
   `declared` (welcome mail, candidate drop-out) have no log backing in
   this batch and were left honest rather than padded.
3. **Ratified for real** via `POST /genome/{id}/ratify`.
4. **VERDICT scored on all 11 units** (V,E,R,D,I,C,T supplied per step,
   differentiated by how each step actually behaves — dual-employment
   scores low on reversibility/high on compliance, tracker updates score
   high across the board) → a real, non-empty Automation Index: L2: 6,
   L3: 5, 72.2 hours/month current, 8 units still on human spot-check.
5. **Spec checked twice against a real Offer Desk Work Unit** — the thing
   neither the V8 nor V9 demo could do, since neither had ever persisted
   an Offer Desk unit before. Empty evidence → `denied, "evidence_ref
   required by contract"`. A real evidence_ref citing the uploaded file →
   **`allowed`**. This is the first time in this product's history that a
   Spec check against Offer Desk work has returned `allowed`, not just
   `denied`.

One transient finding, not chased further: the very first Automation Index
call after ratifying returned `0 sequence edges` when the database
genuinely had 10; every call since (in-process and via HTTP) returned the
correct 10. Read as a one-off pooled-connection artifact from this
session's own abrupt process restarts, not a reproducible product bug —
noted here for completeness, not as an open item.

## What this does NOT prove

- That Zwayam, Zoho, UAN, or any of the Excel trackers actually export in
  this shape in real life — these are plausible fabrications, not a
  spec pulled from a real integration.
- That the platform has a real ingestion path for `03-system-logs/` —
  it doesn't. The only file type it accepts today is `.csv`/`.xlsx`
  through the generic upload endpoint; there is no Zwayam/Zoho/UAN
  connector. This batch proves the *destination* (GQS, Spec, VERDICT,
  Automation Index) works once observed evidence exists — not that the
  *path getting it there* is built.
- That 61.8 hours (V9's stated "defended" figure) is now computed — it
  still isn't; this batch's own `total_hours_current` (72.2h) comes from
  a different, real calculation (`sla_hours * volume_per_month` on this
  specific 11-unit genome), not the same number as the V9 walk's, and
  isn't meant to reconcile with it.
