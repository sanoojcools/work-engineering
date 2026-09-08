/** Genome-import GapKind values the census Gap screen will show
 * (Gates 10 / 6 / 9 plus V10-5b journey and outcome). Other kinds exist
 * in the schema (shadow_process, unimplemented, …) but come from a
 * different mechanism (/discovery/gaps/scan, the census SOP comparison)
 * and must not appear here as if they were this sitting's finding.
 *
 * OfferDeskGap.tsx keeps its own three-kind copy and stays unmodified.
 * Lives in lib/ so CensusGap.tsx and censusExport.ts share one
 * classification — no page-to-page import cycle. */
import { OFFER_DESK_META } from "./offerDeskData";
import { ONBOARDING_SPEC } from "./desks/onboarding";

export const GATE_KINDS = [
  "undeclared",
  "split_recommended",
  "missing_terminal_state",
  "missing_handoff",
  "outcome_not_measured",
] as const;
export type GateKind = (typeof GATE_KINDS)[number];

export function isGateKind(kind: string): kind is GateKind {
  return (GATE_KINDS as readonly string[]).includes(kind);
}

export const KIND_COPY: Record<GateKind, { label: string; simple: string; technical: string }> = {
  undeclared: {
    label: "Said, but not backed up yet",
    simple:
      "Someone described this step in an interview (declared), and no uploaded file or system record (observed) backs the same business object yet. It is a warning, not a rejection — the import still went through.",
    technical: "Gate 10 — GapKind.undeclared. Flagged at genome import, severity P2, advisory only.",
  },
  split_recommended: {
    label: "Reads like more than one job bundled together",
    simple:
      "The object or approver named for this step actually names more than one thing. We flag it for a person to look at — we never split it automatically.",
    technical: "Gate 6 — GapKind.split_recommended. Flagged at genome import, severity P2, advisory only.",
  },
  missing_terminal_state: {
    label: "No clear finish line yet",
    simple:
      "We looked at every before/after state this business object moves through across all its Work Units and never found one that nothing else builds on next — so the process doesn't obviously end anywhere. Needs 3+ Work Units on the same object before we even check.",
    technical: "Gate 9 — GapKind.missing_terminal_state. Flagged at genome import, severity P2, advisory only. No state machine is written.",
  },
  missing_handoff: {
    label: "No handoff to the next desk yet",
    simple:
      "This desk has work, but nothing connects it to the next desk in the journey. A warning, not a rejection — the import still went through. Nobody was invented as the owner of the seam.",
    technical:
      "V10-5b — GapKind.missing_handoff, conformance_gaps.tier=journey. Flagged at genome import, severity P2, advisory only.",
  },
  outcome_not_measured: {
    label: "Promised, not measured",
    simple:
      "The journey named a promise and nothing measured backs it yet. This is a warning, not a score — we do not invent a number to close it.",
    technical:
      "V10-5b — GapKind.outcome_not_measured, conformance_gaps.tier=outcome. Flagged when outcome_records.status is not_measured. Warn, never reject, never a KPI.",
  },
};

// Leading system name only (drop each entry's parenthetical detail) --
// pulled from each desk's own real systems list, not retyped.
const firstWord = (s: string) => s.split(" (")[0];
export const OFFER_SYSTEMS = OFFER_DESK_META.systems.map(firstWord).join(", ");
export const ONBOARDING_SYSTEMS = ONBOARDING_SPEC.systems.map(firstWord).join(", ");

// The "what this journey cannot see" prose, split into a bold lead + body so
// CensusGap.tsx's JSX can keep its original emphasis while censusExport.ts
// quotes the exact same two findings as one plain string, instead of a
// second paraphrase invented for the download.
export const CANNOT_SEE_CONNECTOR_LEAD = "No connector, on either desk.";
export const CANNOT_SEE_CONNECTOR_BODY =
  `Offer Desk's own transition notes name ${OFFER_SYSTEMS}; Onboarding's own systems list names ` +
  `${ONBOARDING_SYSTEMS}. This platform reads none of them — every "declared" or "observed" label anywhere on ` +
  "this journey comes from an interview or an uploaded file, never a live event from any of those systems.";
export const CANNOT_SEE_CONNECTOR_NOTE = `${CANNOT_SEE_CONNECTOR_LEAD} ${CANNOT_SEE_CONNECTOR_BODY}`;

export const CANNOT_SEE_JUDGMENT_LEAD = "Judgment-blind.";
export const CANNOT_SEE_JUDGMENT_BODY =
  "Offer Desk's own sitting names what a check cannot see: \"judgment on employment gaps, dual employment " +
  "decisions, non-standard documents\" — those calls happen in Rashmi's head, on each candidate, and leave no " +
  "record this platform can compare against (Exception 9: she is the only person who makes them, with no formal " +
  "backup). A gap check can tell you a business object has no corroborating file; it cannot tell you whether a " +
  "judgment call inside a step was made well — on this desk or the next one.";
export const CANNOT_SEE_JUDGMENT_NOTE = `${CANNOT_SEE_JUDGMENT_LEAD} ${CANNOT_SEE_JUDGMENT_BODY}`;
