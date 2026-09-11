/** V10-13 FRONTEND: Chart overlay for GET /simulations/offer-day1.
 * Customer words on glass. Canon (simulator, S1) stays in i-buttons.
 * Guest never calls the endpoint — fires come from the same 18-leaf seed
 * Chart already renders (hireLeaves.ts), using the contract's own order.
 * That is not a second scoring engine: no VERDICT, no hours on a leaf. */
import { DOCUMENT_CHECK_RECORD } from "./offerDeskWorkRecord";
import { HIRE_LEAVES, type HireLeaf } from "./hireLeaves";
import type { SimulationFires, SimulationOut } from "../types";

export type ChartScenario = "careful" | "as-calculated" | "ambitious";

export const CHART_SCENARIOS: { key: ChartScenario; label: string; api: SimulationOut["scenario"] }[] = [
  { key: "careful", label: "Careful", api: "careful" },
  { key: "as-calculated", label: "As calculated", api: "as_calculated" },
  { key: "ambitious", label: "Ambitious", api: "ambitious" },
];

export function scenarioToApi(scenario: ChartScenario): SimulationOut["scenario"] {
  const found = CHART_SCENARIOS.find((s) => s.key === scenario);
  return found ? found.api : "as_calculated";
}

export const FIRES_CUSTOMER: Record<SimulationFires, string> = {
  yes: "fires",
  no: "does not fire",
  outside: "outside",
  human_must_touch: "human must touch",
  blocked: "blocked",
};

export const GUEST_LOOKING_ONLY = "looking only";

/** Same two Plan numbers. Labelled not live — never a live headcount. */
export const GUEST_CAPACITY = {
  labelled: "not_live",
  stated_hours_mo: DOCUMENT_CHECK_RECORD.declaredHours,
  defended_hours_mo: DOCUMENT_CHECK_RECORD.defendedHours,
} as const;

export function simulationsPath(scenario: SimulationOut["scenario"]): string {
  return `/simulations/offer-day1?scenario=${encodeURIComponent(scenario)}`;
}

/** Contract order: external → outside; dual-employment stop → blocked
 * (all three scenarios); human → human must touch; careful floors augment
 * to human must touch; else fires. */
export function firesForLeaf(leaf: HireLeaf, scenario: SimulationOut["scenario"]): SimulationFires {
  if (leaf.band === "external") return "outside";
  if (leaf.stop === "dual_employment") return "blocked";
  if (leaf.band === "human") return "human_must_touch";
  if (scenario === "careful" && leaf.band === "augment") return "human_must_touch";
  return "yes";
}

export function guestFiresById(scenario: SimulationOut["scenario"]): Record<string, SimulationFires> {
  const out: Record<string, SimulationFires> = {};
  for (const leaf of HIRE_LEAVES) {
    out[leaf.id] = firesForLeaf(leaf, scenario);
  }
  return out;
}

export function firesFromSimulation(
  sim: SimulationOut | null,
  fallbackScenario: SimulationOut["scenario"],
): Record<string, SimulationFires> {
  if (!sim) return guestFiresById(fallbackScenario);
  const out: Record<string, SimulationFires> = { ...guestFiresById(fallbackScenario) };
  for (const leaf of sim.leaves) {
    out[leaf.id] = leaf.fires;
  }
  return out;
}
