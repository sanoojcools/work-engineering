import { OFFER_DESK_META, OFFER_DESK_STEPS, OFFER_DESK_TOTAL_SAVINGS } from "./offerDeskData";

/** One work record the Slice E walk hangs on: sheet step 2, document check.
 * Derived from the workbook. Not a saved Work Unit. Talk-only must not write
 * Offer Desk rows into the company list.
 *
 * acceptanceCriteria is step 2's own decisionBranches (offerDeskData.ts),
 * not a paraphrase -- those lines already state exactly what separates
 * "accepted" from "blocked" for this business object. verificationMethod
 * and independentChecker are new (Slice TIGHT-WEDGE T3): the record has no
 * second checker today, which is Exception 9 in offerDeskData.ts
 * (OFFER_DESK_EXCEPTIONS), not an invented gap. */
export const DOCUMENT_CHECK_RECORD = {
  sheetStep: 2,
  name: "Check candidate documents before offer release",
  businessObject: "Candidate offer pack",
  currentCondition: "Documents unchecked",
  desiredCondition: "Accepted or blocked",
  acceptanceCriteria: OFFER_DESK_STEPS.find((s) => s.step === 2)!.decisionBranches,
  owner: "Offer Desk SME",
  sitting: "Rashmi KN, 12 May 2026",
  source: OFFER_DESK_META.interviewSource,
  stopRule: "Dual employment in UAN is a stop. Appetite does not lift it.",
  helperMay: "Draft the missing-document list for the recruiter.",
  helperMayNot: "Release the offer.",
  evidenceRequired: "Checklist result on the candidate pack (complete / missing / dual-employment stop)",
  verificationMethod: "human_spot_check" as const,
  independentChecker: {
    label: "None today",
    detail:
      "Rashmi checks her own list. Exception 9 in the sitting: she is the single point of failure for this desk " +
      "and there is no formal, trained backup for this specific check.",
  },
  declaredHours: 95,
  defendedHours: 61.8,
  declaredHoursLabel: OFFER_DESK_TOTAL_SAVINGS,
};

/** T1: "uncheckable desired -> warn, not reject." A desired condition is
 * only checkable by a stranger if both halves of the check exist: a stated
 * rule for what counts as met (acceptance_criteria) and a stated proof a
 * checker could point to (evidence_required) -- the same pairing Spec's own
 * acceptance/evidence checks and VERDICT's Hard Gate 4 rely on (see
 * ARCHITECTURE.md "Spec API"). Missing either warns; it never hides the
 * card or disables the helper list -- this record happens to pass today,
 * but the check stays real so a future edit that clears one of those two
 * fields would surface here instead of silently going uncheckable. */
export function desiredConditionCheckability(rec: {
  acceptanceCriteria: string[];
  evidenceRequired: string;
}): { checkable: boolean; reason: string } {
  const hasAcceptance = rec.acceptanceCriteria.length > 0;
  const hasEvidence = rec.evidenceRequired.trim().length > 0;
  if (hasAcceptance && hasEvidence) {
    return {
      checkable: true,
      reason: "Acceptance criteria and required evidence are both stated, so a stranger could check this.",
    };
  }
  const missing = [!hasAcceptance && "acceptance criteria", !hasEvidence && "evidence required"]
    .filter(Boolean)
    .join(" and ");
  return {
    checkable: false,
    reason: `No ${missing} stated for this desired condition — a stranger could not check it yet. Warning only: the card still renders and the helper list still works.`,
  };
}

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
