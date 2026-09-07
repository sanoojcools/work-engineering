/** Shared by Work Chart (step 5) and Plan (step 6): the one Work System's
 * two lanes (Offer Desk + Onboarding), each desk's steps matched against
 * this tenant's real Work Units by the same two real code shapes this app's
 * import paths actually produce. Extracted from CensusWorkChart.tsx
 * (CENSUS-v0) unchanged when Plan needed the identical matching -- a second,
 * separately-maintained copy of candidateCodes() would be exactly the kind
 * of drift risk this codebase's own "no second scoring engine" discipline
 * refuses elsewhere. */
import { DESKS_BY_ID } from "./desks";
import type { DeskSpec, DeskStep } from "./desks/types";
import type { Verdict, WorkUnit } from "../types";
import { scenarioStrip, type ScenarioStrip } from "./offerDeskScenarios";

export const LANE_DESK_IDS = ["offer-desk", "onboarding"] as const;
export type LaneDeskId = (typeof LANE_DESK_IDS)[number];

const DESK_CODE_PREFIX: Record<LaneDeskId, string> = { "offer-desk": "OD", onboarding: "ONB" };

/** Real matched-code candidates for one sheet step -- the family-genome
 * 3-digit code (HrFamilyGenome.tsx's own scheme, covers both lanes) tried
 * first, then Offer Desk's own 2-digit evidence-pack code (the only path
 * in this app that actually clears the quality gate for Offer Desk units).
 * Never invented: these are the exact two code shapes this codebase's own
 * import paths already produce. */
export function candidateCodes(deskId: LaneDeskId, position: number): string[] {
  const prefix = DESK_CODE_PREFIX[deskId];
  const codes = [`WU-${prefix}-${String(position).padStart(3, "0")}`];
  if (deskId === "offer-desk") codes.push(`WU-OD-${String(position).padStart(2, "0")}`);
  return codes;
}

export function documentCheckRoute(deskId: LaneDeskId, position: number): string {
  if (deskId === "offer-desk" && position === 2) return "/scout/offer-desk/document-check";
  if (deskId === "offer-desk") return "/scout/offer-desk";
  return "/hr/operations/onboarding";
}

export type ChartRow = {
  id: number;
  displayCode: string;
  name: string;
  spoc: string;
  matched: WorkUnit | null;
  strip: ScenarioStrip;
  clickTo: string;
};

export function buildRows(
  deskId: LaneDeskId,
  desk: DeskSpec,
  units: WorkUnit[],
  verdicts: Verdict[],
): ChartRow[] {
  return desk.steps.map((step: DeskStep, i: number) => {
    const position = i + 1;
    const codes = candidateCodes(deskId, position);
    const matched = units.find((u) => codes.includes(u.code)) ?? null;
    const verdict = matched ? verdicts.find((v) => v.work_unit_id === matched.id) ?? null : null;
    return {
      id: i,
      displayCode: matched ? matched.code : `(step ${step.id} — not imported)`,
      name: step.name,
      spoc: step.spoc,
      matched,
      strip: scenarioStrip(verdict),
      clickTo: documentCheckRoute(deskId, position),
    };
  });
}

/** Every real (matched) row across both lanes, in a fixed reading order --
 * what Plan's moderation picker offers, so it can only ever cite a code
 * that both exists on this tenant AND is one of this journey's own units. */
export function allMatchedRows(units: WorkUnit[], verdicts: Verdict[]): ChartRow[] {
  return LANE_DESK_IDS.flatMap((deskId) => buildRows(deskId, DESKS_BY_ID[deskId], units, verdicts)).filter(
    (row): row is ChartRow & { matched: WorkUnit } => row.matched !== null,
  );
}
