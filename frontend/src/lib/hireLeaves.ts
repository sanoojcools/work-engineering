/** V10-4 Chart seed. Faithful frontend reading of packs/hr/hire_leaves.yaml.
 * Exactly 18 leaves. Do not add a 19th. Do not invent defended hours per leaf.
 * 61.8 stays the Offer Desk defended total on Plan, never printed on a leaf.
 * Checked-by names are stand-ins — Chart must not show Rashmi or Zwayam. */
import type { Verdict, WorkUnit } from "../types";
import { scenarioStrip, type ScenarioStrip } from "./offerDeskScenarios";

export const HIRE_BANDS = ["automate", "augment", "human", "external"] as const;
export type HireBand = (typeof HIRE_BANDS)[number];

export type HireLeaf = {
  id: `WU-HIRE-${string}`;
  name: string;
  parent: string;
  band: HireBand;
  step: number;
  raja?: string;
  stop?: "dual_employment";
};

export const HIRE_COMPOSITE = {
  id: "HIRE-COMPLETE",
  name: "The hire is complete",
  workSystem: "offer-day1",
} as const;

export const HIRE_BAND_LABEL: Record<HireBand, string> = {
  automate: "System can do this",
  augment: "Person with a system",
  human: "A person does this",
  external: "Outside this desk",
};

export const HIRE_BAND_HINT: Record<HireBand, string> = {
  automate: "A system can carry this piece once the rule is stated. Still a declared band, not a live connector.",
  augment: "A person works with a system on this piece. The person stays in the loop.",
  human: "A person does this piece. Appetite does not move it into a system.",
  external: "This piece sits outside the desk — recruiter, vendor, or candidate. It is still part of the hire.",
};

/** Parent shares of the sitting mix from hire_leaves.yaml. Sum of non-zero
 * parents is 100 of that mix; Plan still shows 95 stated / 61.8 defended
 * as Offer Desk totals. request and exceptions stay 0 so 95 is not doubled. */
export const PARENT_STATED_HRS_MO: Record<string, number> = {
  docs: 38,
  fitment: 14,
  trackers: 19,
  offer: 14,
  post_offer: 10,
  handoff: 5,
  request: 0,
  exceptions: 0,
};

export const HIRE_LEAVES: readonly HireLeaf[] = [
  { id: "WU-HIRE-01", name: "Recruiter request received", parent: "request", band: "external", step: 1 },
  { id: "WU-HIRE-02", name: "Documents present", parent: "docs", band: "automate", step: 2, raja: "present" },
  { id: "WU-HIRE-03", name: "Documents consistent", parent: "docs", band: "augment", step: 2, raja: "consistent" },
  { id: "WU-HIRE-04", name: "Identity matches", parent: "docs", band: "augment", step: 2, raja: "identity" },
  { id: "WU-HIRE-05", name: "Dual employment / integrity", parent: "docs", band: "human", step: 2, raja: "integrity", stop: "dual_employment" },
  { id: "WU-HIRE-06", name: "Salary vs grid", parent: "fitment", band: "automate", step: 3 },
  { id: "WU-HIRE-07", name: "Variable-pay rule", parent: "fitment", band: "automate", step: 3 },
  { id: "WU-HIRE-08", name: "Master joining sheet", parent: "trackers", band: "automate", step: 4 },
  { id: "WU-HIRE-09", name: "Contractor PR sheet", parent: "trackers", band: "augment", step: 4 },
  { id: "WU-HIRE-10", name: "Offer clauses", parent: "offer", band: "augment", step: 5, raja: "clauses" },
  { id: "WU-HIRE-11", name: "Offer signed in window", parent: "offer", band: "augment", step: 5, raja: "signed_in_window" },
  { id: "WU-HIRE-12", name: "Vendor letter released", parent: "offer", band: "external", step: 5, raja: "vendor_release" },
  { id: "WU-HIRE-13", name: "Candidate signs", parent: "offer", band: "external", step: 5 },
  { id: "WU-HIRE-14", name: "Onboarding acknowledgement", parent: "post_offer", band: "automate", step: 6 },
  { id: "WU-HIRE-15", name: "Welcome mail", parent: "post_offer", band: "automate", step: 7 },
  { id: "WU-HIRE-16", name: "Email ID (max 18 chars)", parent: "post_offer", band: "automate", step: 8 },
  { id: "WU-HIRE-17", name: "Files placed + SPOC notified", parent: "handoff", band: "augment", step: 9 },
  { id: "WU-HIRE-18", name: "Exceptions / deviation", parent: "exceptions", band: "human", step: 2, raja: "exceptions" },
];

if (HIRE_LEAVES.length !== 18) {
  throw new Error(`hire_leaves seed must be exactly 18 leaves, got ${HIRE_LEAVES.length}`);
}
if (!HIRE_BANDS.includes("external")) {
  throw new Error("hire_leaves seed must include an external band");
}

/** Stand-in names only. Never Rashmi, never a live applicant-tracking brand. */
const CHECKED_BY: Record<HireLeaf["id"], string> = {
  "WU-HIRE-01": "Kiran P. (stand-in) — recruiter, outside this desk",
  "WU-HIRE-02": "Asha M. (stand-in)",
  "WU-HIRE-03": "Asha M. (stand-in)",
  "WU-HIRE-04": "Asha M. (stand-in)",
  "WU-HIRE-05": "Asha M. (stand-in)",
  "WU-HIRE-06": "Asha M. (stand-in)",
  "WU-HIRE-07": "Asha M. (stand-in)",
  "WU-HIRE-08": "Asha M. (stand-in)",
  "WU-HIRE-09": "Asha M. (stand-in)",
  "WU-HIRE-10": "Asha M. (stand-in)",
  "WU-HIRE-11": "Asha M. (stand-in)",
  "WU-HIRE-12": "Meera V. (stand-in) — vendor, outside this desk",
  "WU-HIRE-13": "Arjun S. (stand-in) — candidate, outside this desk",
  "WU-HIRE-14": "Asha M. (stand-in)",
  "WU-HIRE-15": "Asha M. (stand-in)",
  "WU-HIRE-16": "Asha M. (stand-in)",
  "WU-HIRE-17": "Asha M. (stand-in)",
  "WU-HIRE-18": "Asha M. (stand-in)",
};

for (const leaf of HIRE_LEAVES) {
  const who = CHECKED_BY[leaf.id];
  if (/rashmi|zwayam/i.test(who) || /rashmi|zwayam/i.test(leaf.name)) {
    throw new Error(`Chart seed must not carry Rashmi or Zwayam (${leaf.id})`);
  }
}

export type HireLeafRow = {
  leaf: HireLeaf;
  displayCode: string;
  checkedBy: string;
  howWeKnow: string;
  matched: WorkUnit | null;
  verdict: Verdict | null;
  strip: ScenarioStrip;
  clickTo: string;
};

export function hireLeafRoute(leaf: HireLeaf): string {
  if (leaf.stop === "dual_employment") return "/scout/offer-desk/document-check";
  if (leaf.parent === "post_offer" || leaf.parent === "handoff") return "/hr/operations/onboarding";
  return "/scout/offer-desk";
}

export function buildHireLeafRows(units: WorkUnit[], verdicts: Verdict[]): HireLeafRow[] {
  return HIRE_LEAVES.map((leaf) => {
    const matched = units.find((u) => u.code === leaf.id) ?? null;
    const verdict = matched ? verdicts.find((v) => v.work_unit_id === matched.id) ?? null : null;
    return {
      leaf,
      displayCode: matched ? matched.code : leaf.id,
      checkedBy: CHECKED_BY[leaf.id],
      howWeKnow: matched ? "This tenant has a record for this code" : "Declared seed — not a live record",
      matched,
      verdict,
      strip: scenarioStrip(verdict),
      clickTo: hireLeafRoute(leaf),
    };
  });
}

const PARENT_HOURS_SHOWN = ["docs", "fitment", "trackers", "offer", "post_offer", "handoff"] as const;
export const PARENT_HOURS_NOTE =
  "Parent shares of the sitting mix: " +
  PARENT_HOURS_SHOWN.map((key) => `${key.replaceAll("_", "-")} ${PARENT_STATED_HRS_MO[key]}`).join(", ") +
  " hrs/mo. Request and exceptions are 0 (outside the desk / inside docs judgment), so the 95 is not counted twice. " +
  "The defended total stays on Plan — it is not printed on a leaf.";
