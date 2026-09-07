# Desk sittings — real Trianz Time & Motion Study

**Everything in this folder is real, not synthetic.** Six Agent-Ready
workflow documents produced by Trianz's own Time & Motion Study, May 2026 —
the opposite of `offer-desk-inputs/`, which is explicitly fabricated test
evidence. These are the original sitting workbooks, kept as read-only
source. Parsed TypeScript, used by the app, lives in
`frontend/src/lib/desks/*.ts` — one file per desk, verbatim step text
copied out of the matching sheet below, nothing paraphrased or invented.

## Provenance

Sourced from an internal Trianz email, forwarded to this repo's owner:

> From: Sriharshini Rallabandi (Trianz) <sriharshini.r@trianz.com>
> Sent: Thursday, May 21, 2026 10:41 AM
> Subject: Time & Motion Study – Completed & Pending Workflow Documentation
>
> Hi Sanuj, PFA all the documents related to the Time and Motion Study
> conducted to date. **The Offboarding and Onboarding workflows have been
> finalized, while the remaining areas have been covered through sessions
> and will require post follow-up documentation and validation to be
> completed.**

That one sentence is the honesty status for this whole folder — repeated
below per file rather than paraphrased into something stronger.

## Files (original attachment name → stored as)

| Original attachment | Stored as | Sheet | Status |
|---|---|---|---|
| `OfferDesk_Agent_Ready.xlsx` | `OfferDesk_Agent_Ready.xlsx` | Offer Desk - Agent Ready | Live — already the source for `frontend/src/lib/offerDeskData.ts` (Rashmi KN, 12 May 2026). Not re-parsed by this slice; see `frontend/src/lib/desks/offerDesk.ts`, an adapter over that existing file. |
| `Onboarding_Agent_Ready_Final.xlsx` | `Onboarding_Agent_Ready_Final.xlsx` | Onboarding - Agent Ready | **Finalized** per the email above. Prerana Nayak (BLR), Sasikala (HYD), Thamizh (CHN); 12 May + 12 May 2026 interview sessions. |
| `Offboarding_Agent_Ready_v2 (003).xlsx` | `Offboarding_Agent_Ready_v2.xlsx` | Offboarding - Agent Ready | **Finalized** per the email above. Sasikala Penigalapati, 7 May + 12 May 2026 interview sessions. |
| `VendorMgmt_Agent_Ready.xlsx` | `VendorMgmt_Agent_Ready.xlsx` | Vendor Mgmt - Agent Ready | **Needs follow-up** per the email above ("covered through sessions", not finalized). Reshma V, 14 May 2026. |
| `USHR_Agent_Ready.xlsx` | `USHR_Agent_Ready.xlsx` | US HR - Agent Ready | **Needs follow-up** per the email above. Rashmi KN, 14 May 2026 — the same Rashmi KN as Offer Desk, a second desk, not a duplicate of the first. |
| `Copy of HRBP_Agent_Ready_Onboarding_Offboarding_GR.xlsx` | `HRBP_Agent_Ready_Onboarding_Offboarding_GR.xlsx` | HRBP - Agent Ready | **Needs follow-up** per the email above. Thamizh Tharagai Pachaiyappan + Rajitha Shaganti, 15 May 2026. Covers HRBP's own involvement in onboarding (meet & greet, induction), offboarding (resignation talk, retention, manage-out), and grievance/WFH handling — an overlay on top of the Onboarding/Offboarding desks, not a third copy of them.

The `(003)` and `Copy of` fragments are artifacts of the email's own
forwarding chain (Aug 16 2026, sanoojcools@gmail.com → Raja Perumal),
not part of the workbook content — dropped from the stored filename,
kept here for traceability back to the original attachment.

## What this does NOT mean

- "Finalized" (Onboarding, Offboarding, Offer Desk) means the *workflow
  documentation* was validated by its SME(s) — not that the platform has
  observed logs for any of it. No desk in this repo has an ingestion path
  from Darwinbox/Oracle/Job Vite; every number here is *declared* (the
  sitting's own words), never *observed* (a system export), the same
  distinction `docs/HONESTY.md` draws for Offer Desk.
- "Needs follow-up" (Vendor Mgmt, US HR, HRBP) is Trianz's own qualifier,
  not this repo's guess — carried into every screen that reads these three
  desks (`IoPanes`, desk-walk pages, the function work graph) rather than
  smoothed over.
- None of the six sheets state observed system-of-record events for any
  step. Nothing here is upgraded to "observed" by being copied into this
  repo.
