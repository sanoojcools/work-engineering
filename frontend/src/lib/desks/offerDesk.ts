/** Adapter, not a rewrite: maps the existing, untouched OFFER_DESK_*
 * constants (offerDeskData.ts -- Rashmi KN, 12 May 2026, transcribed
 * verbatim there already) into the shared DeskSpec shape so Offer Desk can
 * appear on the HR Function Work Graph next to the five new desks without
 * cloning its content a second time. Nothing here is re-typed from the
 * sheet; every field reads straight from offerDeskData.ts. */
import {
  OFFER_DESK_HANDOFFS,
  OFFER_DESK_META,
  OFFER_DESK_STEPS,
  OFFER_DESK_TOTAL_SAVINGS,
  STEP_TITLES,
} from "../offerDeskData";
import type { DeskHandoff, DeskSpec, DeskStep } from "./types";

const steps: DeskStep[] = OFFER_DESK_STEPS.map((s) => ({
  id: String(s.step),
  name: STEP_TITLES[s.step],
  whatHappens: s.whatHappens,
  system: s.system,
  timePerCase: s.timePerCase,
  volumePerMonth: s.volumePerMonth,
  automationTag: s.automationTag,
  // Step 1 is the recruiter's own action, ahead of Rashmi -- the step's own
  // "What happens" text says so ("Recruiter sends offer request..."), not
  // an invented actor. Every other step is Rashmi's, per Primary SPOC.
  spoc: s.step === 1 ? "Recruiter (before Rashmi)" : OFFER_DESK_META.primarySpoc,
}));

const handoffs: DeskHandoff[] = OFFER_DESK_HANDOFFS.map((h) => ({
  from: h.from,
  to: h.to,
  whatIsPassed: h.whatIsPassed,
  format: h.format,
  trigger: h.trigger,
}));

export const OFFER_DESK_SPEC: DeskSpec = {
  id: "offer-desk",
  name: "Offer Desk",
  workflowName: OFFER_DESK_META.workflowName,
  category: OFFER_DESK_META.category,
  outcome: OFFER_DESK_META.outcome,
  trigger: OFFER_DESK_META.trigger,
  frequency: OFFER_DESK_META.frequency,
  monthlyEffortProfile: OFFER_DESK_META.monthlyEffortProfile,
  primarySpoc: OFFER_DESK_META.primarySpoc,
  backup: OFFER_DESK_META.backup,
  systems: OFFER_DESK_META.systems,
  steps,
  handoffs,
  interviewSource: OFFER_DESK_META.interviewSource,
  totalEstimatedSavings: OFFER_DESK_TOTAL_SAVINGS,
  sourceFile: "desks/OfferDesk_Agent_Ready.xlsx",
  status: "finalized",
};
