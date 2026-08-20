export interface TourStep {
  id: string;
  title: string;
  message: string;
  target: string;
  nextLabel: string;
  page: string;
}

export const TOUR_STEPS: TourStep[] = [
  { id: "overview", title: "Welcome to Work Engineering", message: "This is the spec layer that turns time-motion studies into machine-enforceable contracts. Start with the O2C census, then add HR units such as WU-ONB-04.", target: "[data-tour=overview]", nextLabel: "Next: Create Employee Type", page: "/" },
  { id: "ontology", title: "Ontology = Things we work on", message: "Create Employee type with lifecycle: draft -> pre_joining -> active -> offboarded. Needed before HR Work Units.", target: "[data-tour=ontology]", nextLabel: "Next: Create Work Unit", page: "/ontology" },
  { id: "work-units-create", title: "Create your first HR Work Unit", message: "Click New Work Unit. Fill Code WU-ONB-04, Business Object Employee, Owner and Authority HR Ops SPOC, Current and Desired conditions.", target: "[data-tour=new-work-unit]", nextLabel: "Next: Reconcile", page: "/work-units" },
  { id: "work-units-reconcile", title: "Reconcile = Make it machine-readable", message: "After creating, the new row is highlighted. Click it, then hit Reconcile. Readable should become yes.", target: "[data-tour=reconcile]", nextLabel: "Next: Score VERDICT", page: "/work-units" },
  { id: "verdict", title: "VERDICT = Can a robot do this?", message: "Score seven questions 1-5. For welcome mail, set 5,5,5,5,4,5,5. Then click Save & Derive Autonomy.", target: "[data-tour=verdict-scores]", nextLabel: "Next: Verify", page: "/verdict" },
  { id: "verification", title: "Verification = Proof it works", message: "Promotion needs 5 passing runs. Click Bulk create 5. That unblocks promotion.", target: "[data-tour=verification]", nextLabel: "Next: Promote", page: "/verification" },
  { id: "promotion", title: "Promotion = One level at a time", message: "You can only go L1 to L2, then L2 to L3. Needs human approval. The stepper shows this instead of an error toast.", target: "[data-tour=promote]", nextLabel: "Next: Spec API", page: "/work-units" },
  { id: "spec-api", title: "Spec API = Door that bots call", message: "X-Spec-Key is prefilled. Select WU-ONB-04. Approver auto-fills to HR Ops SPOC. Try authority, then evidence, condition, acceptance.", target: "[data-tour=spec-api]", nextLabel: "Next: Projections", page: "/spec" },
  { id: "projections", title: "Projections = 5 views of same truth", message: "Inventory, Graph, Verification, Allocation, Economics. Your HR units appear here.", target: "[data-tour=projections]", nextLabel: "Finish Tour", page: "/projections" },
];

export const EDUCATIONAL_NUDGES: Record<string, { title: string; message: string; nextLabel: string; nextPage: string }> = {
  "work-unit-created": { title: "Work Unit created", message: "Scroll to the highlighted row, click it, then Reconcile. Next: score VERDICT.", nextLabel: "Go to VERDICT", nextPage: "/verdict" },
  "verdict-derived": { title: "VERDICT derived", message: "Next: create 5 verification runs to unblock promotion.", nextLabel: "Go to Verification", nextPage: "/verification" },
  "needs-verification": { title: "Needs 5 verification runs", message: "Promotion needs proof. You have 0/5. Bulk create 5 passing runs.", nextLabel: "Create 5 runs now", nextPage: "/verification" },
  "promotion-blocked-level": { title: "Promotion moves one level at a time", message: "For safety you can only go L1 to L2, then L2 to L3. Use the stepper.", nextLabel: "Promote to L2", nextPage: "/work-units" },
  "spec-api-deny": { title: "DENY = governance working", message: "Blocked because authority, evidence, or state did not match. Use HR Ops SPOC and the examples below.", nextLabel: "Show example", nextPage: "/spec" },
};
