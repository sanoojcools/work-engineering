/** OBJECTS-HOURS slice A: Box 1 lite — three reference cards for the
 * business objects the family genome's Work Units actually name, wired to
 * real desks/units. This is deliberately NOT the real Ontology backend
 * (models/ontology.py's EntityType/Entity, gated behind Palantir/Box 1 in
 * docs/BUILD_PROGRAM.md, "Later or refuse") — no endpoint, no table, no
 * live read. It is three static cards built client-side from the same
 * DeskSpec/familyGenome data already on the walk, so "which desks/units
 * reference it" can never silently drift from the real genome payload.
 *
 * The desk-to-object wiring is the brief's own, not derived: Offer Desk ->
 * Offer; Onboarding/Offboarding/HRBP -> Employee; Vendor Mgmt (+ Offer
 * Desk's own contractor-offer path) -> Contractor. US HR is deliberately
 * not wired to any of the three -- the brief names five of six desks and
 * leaves US HR out, and nothing here should quietly invent that sixth
 * mapping. */
import { buildFamilyGenomePayload } from "./familyGenome";
import { DESKS_BY_ID } from "./index";

export type ObjectDeskRef = {
  deskId: string;
  deskName: string;
  unitCodes: string[];
  /** Set only for a partial reference (a named subset of a desk's units),
   * e.g. Offer Desk's own contractor-labeled steps -- never set for a
   * desk wired in full. */
  note?: string;
};

export type ObjectCard = {
  id: "employee" | "offer" | "contractor";
  name: string;
  /** Informal category, not a claim about models/ontology.py's EntityKind
   * -- Box 1 lite has no backend counterpart to be consistent with. */
  type: string;
  /** Plain-English state, paraphrased from the contributing desks' own
   * `outcome` fields (DeskSpec, verbatim source), not invented ERP status
   * language ("in_progress" / "committed" / etc.). */
  currentCondition: string;
  deskRefs: ObjectDeskRef[];
  /** One line per contributing sitting -- the real interview date(s) and
   * interviewee(s), same citation each desk's own page already carries. */
  asOf: string[];
};

const { unitsByDesk } = buildFamilyGenomePayload();

function fullDeskRef(deskId: string): ObjectDeskRef {
  const desk = DESKS_BY_ID[deskId];
  return { deskId, deskName: desk.name, unitCodes: unitsByDesk[deskId].map((u) => u.id) };
}

/** Offer Desk's own contractor-specific branches -- steps whose real
 * `whatHappens` text names a "CONTRACTOR:"-labeled path (Asset-vendor
 * offer release, PR-sheet update, contractor document set), the sheet's
 * own convention for hire-type branches. Computed live against the real
 * step text, not a hardcoded step-number list, so it cannot drift from
 * the source if a future edit changes which steps carry that branch. */
function offerDeskContractorPathRef(): ObjectDeskRef {
  const offerDesk = DESKS_BY_ID["offer-desk"];
  const units = unitsByDesk["offer-desk"];
  const codes = offerDesk.steps
    .map((step, i) => ({ step, code: units[i].id }))
    .filter(({ step }) => /CONTRACTOR/.test(step.whatHappens))
    .map(({ code }) => code);
  if (codes.length === 0) {
    throw new Error("Expected at least one Offer Desk step to name a CONTRACTOR branch — source data changed?");
  }
  return {
    deskId: "offer-desk",
    deskName: "Offer Desk",
    unitCodes: codes,
    note: "contractor-labeled branches only (document set, PR sheet, Asset-vendor offer release) — not all 11 Offer Desk units",
  };
}

export const OBJECT_CARDS: ObjectCard[] = [
  {
    id: "offer",
    name: "Offer",
    type: "Commitment to hire — a candidate's offer, not yet an employee",
    currentCondition:
      "A candidate's offer moves from a recruiter's request through document verification and signing to a " +
      "released, signed offer letter (PR sheet updated too, for contractors) — then the candidate is handed to " +
      "Onboarding. Paraphrased from Offer Desk's own stated outcome, not invented ERP status language.",
    deskRefs: [fullDeskRef("offer-desk")],
    asOf: ["12 May 2026 — Rashmi KN, Offer Desk sitting (declared)"],
  },
  {
    id: "employee",
    name: "Employee",
    type: "Person on the payroll, from first day to (for some) separation",
    currentCondition:
      "Moves from a new hire with an activated Darwinbox record and an assigned buddy, through HRBP-run " +
      "induction, to — for those who leave — a terminated record with clearances, recoveries, and final " +
      "settlement complete. HRBP is named at both ends: induction on the way in, counseling and exit oversight " +
      "on the way out. Paraphrased from Onboarding's, Offboarding's, and HRBP's own stated outcomes.",
    deskRefs: [fullDeskRef("onboarding"), fullDeskRef("offboarding"), fullDeskRef("hrbp")],
    asOf: [
      "6+12 May 2026 — Prerana Nayak, Onboarding sitting (declared)",
      "7+12 May 2026 — Sasikala Penigalapati, Offboarding sitting (declared)",
      "15 May 2026 — Thamizh Tharagai Pachaiyappan + Rajitha Shaganti, HRBP sitting (declared)",
    ],
  },
  {
    id: "contractor",
    name: "Contractor",
    type: "Non-employee engagement — vendor-invoiced, not on the payroll",
    currentCondition:
      "Tracked through invoicing, timesheets, empanelment, and PR/PO paperwork in Vendor Mgmt — plus a distinct " +
      "path inside Offer Desk itself (its own CONTRACTOR-labeled branches: a different document set, a PR-sheet " +
      "update, Asset-vendor offer release) when a contractor is being hired or converted toward full-time. " +
      "Paraphrased from Vendor Mgmt's own stated outcome and Offer Desk's own contractor branches.",
    deskRefs: [fullDeskRef("vendor-mgmt"), offerDeskContractorPathRef()],
    asOf: [
      "14 May 2026 — Reshma V, Vendor Mgmt sitting (declared)",
      "12 May 2026 — Rashmi KN, Offer Desk sitting, contractor-labeled steps only (declared)",
    ],
  },
];

export const OBJECTS_BY_ID: Record<string, ObjectCard> = Object.fromEntries(OBJECT_CARDS.map((o) => [o.id, o]));

/** The function graph's own click-through: which object card a desk NODE
 * links to (its primary wiring, one object each) and which object card a
 * HANDOFF EDGE links to (the object that handoff is actually about). US HR
 * has no entry in DESK_TO_OBJECT on purpose -- see the module doc comment. */
export const DESK_TO_OBJECT: Record<string, ObjectCard["id"]> = {
  "offer-desk": "offer",
  onboarding: "employee",
  offboarding: "employee",
  hrbp: "employee",
  "vendor-mgmt": "contractor",
};

export const HANDOFF_TO_OBJECT: Record<string, ObjectCard["id"]> = {
  "offer-desk->onboarding": "employee", // the handoff itself is a candidate becoming an employee
  "offboarding->hrbp": "employee",
  "hrbp->offboarding": "employee",
  "vendor-mgmt->offer-desk": "contractor", // named explicitly: "Contractor conversion request"
};
