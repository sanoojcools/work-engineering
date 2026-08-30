export interface TourStep {
  id: string;
  title: string;
  message: string;
  target: string;
  nextLabel: string;
  page: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "overview",
    title: "One company, one function",
    message: "This is the specification layer. A census is one employer × one function, not the mixed Catalog. Click Prepare Client A HR demo, then keep Client A selected in the switcher.",
    target: "[data-tour=overview]",
    nextLabel: "Next: Inventory",
    page: "/",
  },
  {
    id: "work-units",
    title: "Work Units = the contract",
    message: "Twelve HR units stacked. Run census if you want a different SOP. Catalog is the test lab — switch back only to see mixed samples.",
    target: "[data-tour=new-work-unit]",
    nextLabel: "Next: Gaps",
    page: "/work-units",
  },
  {
    id: "discovery",
    title: "Gap = declared vs inventory",
    message: "Paste SOP or job description. Unimplemented units are what the SOP forgot. That gap report is the first thing a census produces that anyone pays for.",
    target: "[data-tour=discovery]",
    nextLabel: "Next: Five projections",
    page: "/discovery",
  },
  {
    id: "projections",
    title: "Five views of the same records",
    message: "Inventory, graph, verification contracts, allocation, economics. Not a queue of artefacts. Download the pack for this company.",
    target: "[data-tour=projections]",
    nextLabel: "Next: VERDICT drafts",
    page: "/projections",
  },
  {
    id: "verdict",
    title: "Inferred until you confirm",
    message: "Census drafted scores from the contract. Say they are drafts. Save on this page to confirm. Re-running census will not overwrite a confirmed score.",
    target: "[data-tour=verdict-scores]",
    nextLabel: "Finish Tour",
    page: "/verdict",
  },
];

export const EDUCATIONAL_NUDGES: Record<string, { title: string; message: string; nextLabel: string; nextPage: string }> = {
  "work-unit-created": { title: "Work Unit created", message: "Scroll to the highlighted row, click it, then Reconcile. Next: score VERDICT.", nextLabel: "Go to VERDICT", nextPage: "/verdict" },
  "verdict-derived": { title: "VERDICT derived", message: "If this was a census draft it is inferred. Saving here confirms it. Next: economics or projections.", nextLabel: "Go to Projections", nextPage: "/projections" },
  "needs-verification": { title: "Needs 5 verification runs", message: "Promotion needs proof. You have 0/5. Bulk create 5 passing runs.", nextLabel: "Create 5 runs now", nextPage: "/verification" },
  "promotion-blocked-level": { title: "Promotion moves one level at a time", message: "For safety you can only go L1 to L2, then L2 to L3. Use the stepper.", nextLabel: "Promote to L2", nextPage: "/work-units" },
  "spec-api-deny": { title: "DENY = governance working", message: "Blocked because authority, evidence, or state did not match. Use HR Ops SPOC and the examples below.", nextLabel: "Show example", nextPage: "/spec" },
};
