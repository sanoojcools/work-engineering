/** V10-5b UI (docs/NEXT.md): census Gap (step 4) buckets live
 * `conformance_gaps.tier` into three customer-facing headings.
 * Canon names (process / journey / outcome) live in i-buttons only.
 *
 * Lives in lib/ so CensusGap.tsx and censusExport.ts read the same
 * headings, empty copy, and tier-from-row helper — one classification,
 * two renderers, no page-to-page import cycle. */
import type { Gap, GapTier } from "../types";
import { GAP_TIERS } from "../types";

export { GAP_TIERS };
export type { GapTier };

export const TIER_COPY: Record<
  GapTier,
  {
    heading: string;
    term: string;
    simple: string;
    technical: string;
    emptyGuest: string;
    emptyKeyed: string;
  }
> = {
  process: {
    heading: "This desk",
    term: "process",
    simple: "Disagreement about work on this desk — what was named versus what the sitting described.",
    technical:
      "conformance_gaps.tier = process. Genome-import Gates 10 / 6 / 9 (undeclared, split_recommended, missing_terminal_state). Advisory only.",
    emptyGuest:
      "Guest: the same four walk-only declared-vs-sitting rows shown throughout this walk — not a live query. Looking does not mint a key.",
    emptyKeyed:
      "Nothing flagged for this desk — a true empty state, not a clean bill of health. No genome import on this tenant has tripped a \"said, but not backed up,\" \"reads like more than one job,\" or \"no clear finish line\" check yet.",
  },
  journey: {
    heading: "Handoff to the next desk",
    term: "journey",
    simple:
      "Whether this desk actually hands work to the next desk in the journey. Empty means nobody has checked a live seam, not that the handoff is fine.",
    technical:
      "conformance_gaps.tier = journey. GapKind.missing_handoff, flagged at genome import, severity P2, advisory only. No journey owner is invented.",
    emptyGuest: "Guest: looking only — this walk has no live handoff check. Nothing is saved.",
    emptyKeyed:
      "No missing handoff flagged for this tenant yet — not the same claim as a working seam.",
  },
  outcome: {
    heading: "Promised vs not measured",
    term: "outcome",
    simple:
      "The journey named a promise. Nothing measured backs it yet. This screen never invents a number to close that.",
    technical:
      "conformance_gaps.tier = outcome. GapKind.outcome_not_measured when outcome_records.status is not_measured. Warn, never reject, never a measured KPI.",
    emptyGuest:
      "Guest: this walk does not invent a measured number. The promise stays not measured.",
    emptyKeyed:
      "No outcome gap flagged yet — and this page still will not invent a measured number.",
  },
};

/** Prefer the live column. Kind is only a fallback if an older payload omitted tier. */
export function tierOf(gap: Pick<Gap, "kind"> & { tier?: string | null }): GapTier {
  if (gap.tier === "process" || gap.tier === "journey" || gap.tier === "outcome") return gap.tier;
  if (gap.kind === "missing_handoff") return "journey";
  if (gap.kind === "outcome_not_measured") return "outcome";
  return "process";
}

export function gapsInTier<T extends Pick<Gap, "kind"> & { tier?: string | null }>(
  gaps: ReadonlyArray<T>,
  tier: GapTier,
): T[] {
  return gaps.filter((g) => tierOf(g) === tier);
}
