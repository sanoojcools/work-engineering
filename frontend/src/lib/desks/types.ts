/** HR-FAMILY v0: generalizes Offer Desk's step-list shape
 * (frontend/src/lib/offerDeskData.ts's OfferDeskStep/OFFER_DESK_META) into
 * one type every desk sitting can be parsed into. This is not a second
 * arithmetic or a redesign of that shape -- id, name, what happens, system,
 * time, volume, automation tag, SPOC are exactly Offer Desk's own columns,
 * renamed to be desk-agnostic. offerDesk.ts adapts the existing OFFER_DESK_*
 * constants into this shape without rewriting them; every other desk is
 * parsed straight from its own sheet in desks/*.xlsx into this shape,
 * verbatim -- no field, number, name, or policy invented.
 *
 * "Hours" is deliberately a single declared string per desk, not a
 * declared/defended pair: Offer Desk's 61.8 "defended" figure
 * (offerDeskWorkRecord.ts) came from four costing disciplines applied by a
 * human to that one sitting, not a second number the sheet itself states.
 * None of the other five sheets state a second, independently-defended
 * total -- so none of the other five desks get one invented here. */

export type DeskStatus = "finalized" | "needs_follow_up";

export type DeskStep = {
  /** The sheet's own step id -- "1".."26", or "OB-1" / "OFF-3" / "GR-2"
   * where the sheet itself uses that scheme (HRBP). Never renumbered. */
  id: string;
  /** Short title condensed from this step's own "What happens" opening
   * clause -- the same idiom offerDeskData.ts's STEP_TITLES uses, not a
   * fifth column the sheet has. */
  name: string;
  /** Verbatim "What happens" cell. */
  whatHappens: string;
  /** Verbatim "System" cell. */
  system: string;
  /** Verbatim "Time per case" / "Time" cell -- the sheet's own range text
   * (e.g. "5-10 min"), never collapsed to a computed midpoint. */
  timePerCase: string;
  /** Verbatim "Volume /mo" / "Volume" cell. */
  volumePerMonth: string;
  /** Verbatim "Automation tag" cell. */
  automationTag: string;
  /** Who performs the step -- a named person read from "What happens" /
   * the sheet's own metadata (Primary SPOC, HRBPs Interviewed), not a
   * generic desk-level SPOC unless the step itself names no one else. */
  spoc: string;
};

export type DeskHandoff = {
  from: string;
  to: string;
  whatIsPassed: string;
  format: string;
  trigger: string;
};

export type DeskSpec = {
  /** "offer-desk" | "onboarding" | "offboarding" | "vendor-mgmt" | "us-hr" | "hrbp" */
  id: string;
  /** Short display name for nav cards and the function graph. */
  name: string;
  /** Verbatim "Workflow Name" metadata cell. */
  workflowName: string;
  /** Verbatim "Category" metadata cell. */
  category: string;
  /** Verbatim "Outcome" metadata cell. */
  outcome: string;
  /** Verbatim "Trigger" metadata cell. */
  trigger: string;
  /** Verbatim "Frequency" metadata cell. */
  frequency: string;
  /** Verbatim "Monthly Effort Profile", split on the sheet's own " | "
   * separators. Every number the sheet states stays visible as its own
   * line -- nothing averaged or picked as "the" number. */
  monthlyEffortProfile: string[];
  /** Verbatim "Primary SPOC" (or "HRBPs Interviewed" for hrbp). */
  primarySpoc: string;
  /** Verbatim "Backup" cell, where the sheet has one. */
  backup?: string;
  /** Verbatim "Systems" metadata cell, split on " | ". */
  systems: string[];
  steps: DeskStep[];
  handoffs: DeskHandoff[];
  /** Verbatim "Interview Source(s)" metadata cell. */
  interviewSource: string;
  /** Verbatim "TOTAL ESTIMATED SAVINGS" line -- the sheet's one declared
   * number, never a second "defended" figure this slice did not compute. */
  totalEstimatedSavings: string;
  /** Path under desks/ to the read-only original this was parsed from. */
  sourceFile: string;
  /** Per the founder's 21 May 2026 email (desks/README.md): onboarding and
   * offboarding are finalized; offer-desk is live and already shipped;
   * vendor-mgmt, us-hr, and hrbp still need follow-up documentation and
   * validation. Never inferred -- copied from that one sentence. */
  status: DeskStatus;
};
