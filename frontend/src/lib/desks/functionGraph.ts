import { OFFBOARDING_SPEC, OFFER_DESK_SPEC, VENDOR_MGMT_SPEC } from "./index";
import type { DeskHandoff } from "./types";

export type CrossDeskHandoff = {
  fromDeskId: string;
  toDeskId: string;
  handoff: DeskHandoff;
  citedFrom: string;
};

function find(handoffs: DeskHandoff[], pred: (h: DeskHandoff) => boolean, sheet: string): DeskHandoff {
  const found = handoffs.find(pred);
  if (!found) throw new Error(`Expected handoff row not found in ${sheet} — source data changed?`);
  return found;
}

/** Exactly the three cross-desk handoffs named in the HR-FAMILY v0 brief --
 * no extra edge types, no invented pairs beyond these. Each is read live
 * from the desk's own handoffs array (never re-typed as a second copy of
 * the quote), so this cannot drift from offerDesk.ts / offboarding.ts /
 * vendorMgmt.ts. Offboarding <-> HRBP is genuinely bidirectional in the
 * sitting (Offboarding's own handoff map names both directions); Vendor
 * Mgmt -> Offer Desk only has one directly-named row in either sheet, so
 * only one direction is drawn as an edge -- see HrFunctionGraph.tsx's own
 * note on why that one stays one-way. */
export const CROSS_DESK_HANDOFFS: CrossDeskHandoff[] = [
  {
    fromDeskId: "offer-desk",
    toDeskId: "onboarding",
    handoff: find(OFFER_DESK_SPEC.handoffs, (h) => h.to === "Prerana/Sasikala/Tamil", "Offer Desk's own handoff map"),
    citedFrom: "Offer Desk's own handoff map",
  },
  {
    fromDeskId: "offboarding",
    toDeskId: "hrbp",
    handoff: find(OFFBOARDING_SPEC.handoffs, (h) => h.to === "HRHub (HRBP)", "Offboarding's own handoff map"),
    citedFrom: "Offboarding's own handoff map",
  },
  {
    fromDeskId: "hrbp",
    toDeskId: "offboarding",
    handoff: find(OFFBOARDING_SPEC.handoffs, (h) => h.from === "HRBP", "Offboarding's own handoff map"),
    citedFrom: "Offboarding's own handoff map",
  },
  {
    fromDeskId: "vendor-mgmt",
    toDeskId: "offer-desk",
    handoff: find(VENDOR_MGMT_SPEC.handoffs, (h) => h.to === "Rashmi KN (Offer Desk)", "Vendor Mgmt's own handoff map"),
    citedFrom: "Vendor Mgmt's own handoff map",
  },
];
