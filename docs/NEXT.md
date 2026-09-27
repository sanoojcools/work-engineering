# NEXT — agents read this and execute their section

Dated 27 Sep 2026. GitHub `main` + this file beat chat memory.

**On `main`:** D-1…14, Cuts 1–4, #70–#72, #74 T2 Offboarding, #75 T3 Vendor.
**Cloud factory: LOCKED.** GitHub Actions must not spend Claude credits on product code.

Locks that never move: Offer Desk Journey = 18 leaves from `packs/hr/hire_leaves.yaml`.
Plan **95** and **61.8** are Offer Desk only. Dual-employment stop unliftable.
Guest mints no `we-spec-key`. No DarwinBox connector. No seventh census step.

Canon: `docs/WEP_Discovery_Proposal.md` v2. Companion: `docs/WEP_PRODUCT_AND_BUILD.md`.

409/422 writes = Claude-only after a named sitting. Founder accepted keyed CI 500s on the shared demo tenant.

---

## Claude

**LOCKED for product code.** No D-4 persist. No feature PR. If you are a cloud run: stop.

---

## Cursor — desk queue (one unlocked row)

**How to run:** `git pull origin main`. Read this file. Do **only** the first row whose status is UNLOCKED. One branch, one Ready PR. Do not merge. Stop.

If two UNLOCKED rows exist, you are reading a stale NEXT. Stop.

Shared refuse for every T-row:
- Do not edit `CensusPlan.tsx` 95/61.8 math, `hire_leaves.yaml` count, `handoff.py`.
- Do not paint this desk's steps onto the Offer Desk Journey.
- Do not invent steps; copy `frontend/src/lib/desks/<file>.ts` only.
- Hours: only numbers already in that file. Never print 95 or 61.8 on this desk.
- Guest looking only, no `we-spec-key`.
- Playwright always: guest 1→6; Plan 95 and 61.8; Journey 18 nodes; other desks only on their own walk.

Walk shape for each desk (same as T1–T3):
- Card on Trianz home opens the walk.
- First screen: who runs it + boss (from the ts file).
- Steps behind **Desk as sat (<SPOC>)**, closed by default.

| ID | Status | Branch | Source | SPOC / first step |
|---|---|---|---|---|
| T1 Onboarding | DONE (#72) | `cursor/t1-onboarding-sit` | `onboarding.ts` | Prerana |
| T2 Offboarding | DONE (#74) | `cursor/t2-offboarding-sit` | `offboarding.ts` | Sasikala |
| T3 Vendor | DONE (#75) | `cursor/t3-vendor-sit` | `vendorMgmt.ts` | Reshma V |
| T4 US HR | UNLOCKED | `cursor/t4-ushr-sit` | `frontend/src/lib/desks/usHr.ts` | Rashmi KN (same person as Offer Desk — two desks, do not merge the walks). Backup: none formal (Nanditha knows it). Onboarding session owned by Jayanthi. Boss Rajesh. First step: Recruiter sends BGV request. Hours: ~4 hrs/day from that file. Status needs_follow_up — keep that label |
| T5 HRBP | LOCKED until T4 on `main` | `cursor/t5-hrbp-sit` | `frontend/src/lib/desks/hrbp.ts` | Under Sanuj. From that file only |

After a T-row lands on `main`, Grok flips that row to DONE and the next to UNLOCKED. Cursor does not edit this table.

**Still locked for everyone:** rooms persist (D-4), SME dump (D-5), DarwinBox API, #58 ingest as product work.
