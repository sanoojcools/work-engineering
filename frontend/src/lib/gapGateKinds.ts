/** The only three GapKind values a genome import can produce (Gates 10, 6, 9
 * -- docs/BUILD_PROGRAM.md Track 1 slices 1.1-1.3), duplicated from
 * OfferDeskGap.tsx rather than imported from it: OfferDeskGap "stays
 * reachable" unmodified (F2), so CensusGap.tsx reads the exact same live
 * data through its own small copy instead of refactoring a shipped, tested
 * page to share it.
 *
 * Lives in lib/, not on CensusGap.tsx itself, so lib/censusExport.ts
 * (CENSUS-PACK P1) can cite the exact same three kinds, labels, and
 * "cannot see" findings its markdown export quotes -- one classification
 * read by two renderers, not a second copy invented for the download, and
 * without a page-to-page import cycle (censusExport.ts is also reached
 * from the census shell, which every census page renders). */
import { OFFER_DESK_META } from "./offerDeskData";
import { ONBOARDING_SPEC } from "./desks/onboarding";

export const GATE_KINDS = ["undeclared", "split_recommended", "missing_terminal_state"] as const;
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
