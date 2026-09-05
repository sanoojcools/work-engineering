import { OFFER_DESK_META, OFFER_DESK_STEPS, OFFER_DESK_TOTAL_SAVINGS } from "./offerDeskData";

/** One work record the Slice E walk hangs on: sheet step 2, document check.
 * Derived from the workbook. Not a saved Work Unit. Talk-only must not write
 * Offer Desk rows into the company list. */
export const DOCUMENT_CHECK_RECORD = {
  sheetStep: 2,
  name: "Check candidate documents before offer release",
  businessObject: "Candidate offer pack",
  currentCondition: "Documents unchecked",
  desiredCondition: "Accepted or blocked",
  owner: "Offer Desk SME",
  sitting: "Rashmi KN, 12 May 2026",
  source: OFFER_DESK_META.interviewSource,
  stopRule: "Dual employment in UAN is a stop. Appetite does not lift it.",
  helperMay: "Draft the missing-document list for the recruiter.",
  helperMayNot: "Release the offer.",
  evidenceRequired: "Checklist result on the candidate pack (complete / missing / dual-employment stop)",
  declaredHours: 95,
  defendedHours: 61.8,
  declaredHoursLabel: OFFER_DESK_TOTAL_SAVINGS,
};

export const HOW_WE_CUT = [
  {
    from: "Sheet step 2 is one row in a list of eleven.",
    to: "One work record: move the offer pack from unchecked to accepted or blocked.",
    why: "One owner. One object. One check a stranger can run. Dual employment is inside this cut, not a later mood.",
  },
  {
    from: "The sheet also names salary grid, Master Joining Sheet, 17th payroll pack.",
    to: "Those are other records. We do not fold them into document check to make the list shorter.",
    why: "Different object or different owner or different proof.",
  },
  {
    from: "CHRO stand-in talks outcomes. The desk talks trackers.",
    to: "Playback keeps three columns. The cut does not vote them into one story.",
    why: "Declared upstairs is not the same record as declared at the desk.",
  },
];

export const GAP_ROWS = [
  {
    topic: "What the work is",
    declared: "Safe offer in two hours (CHRO stand-in / sheet outcome)",
    sitting: "Eleven micro-steps with Excel at the centre (Offer Desk SME)",
    gap: "Outcome named. The tracker work is not in the upstairs sentence.",
  },
  {
    topic: "Document check",
    declared: "Docs must be complete. UAN dual employment is a stop.",
    sitting: "40% of the day. Permanent 30–40 min. Hire-type checklists.",
    gap: "Policy exists. Time and hire-type branches live only in the sitting.",
  },
  {
    topic: "System of record",
    declared: "Zwayam / Zoho in the transition notes",
    sitting: "Excel trackers still hold truth. Zero Zwayam events in this demo.",
    gap: "Declared system ≠ observed system. We do not invent the events.",
  },
  {
    topic: "Hours saved",
    declared: "Sheet claims ~95 hrs/mo",
    sitting: "Not measured in this walk. Time on the sheet is per-case, not a verified month.",
    gap: "95 is declared. 61.8 is the defended case after costing discipline.",
  },
];

export const MISSING_DOC_STARTER = [
  "Employment service letter — employer 2",
  "UAN service history PDF",
  "Last 3 months payslip",
  "IEF screenshots for virtual rounds",
];

export function step2() {
  return OFFER_DESK_STEPS.find((s) => s.step === 2)!;
}
