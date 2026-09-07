/** OBJECTS-HOURS slice B: declared hours by desk, read straight off each
 * DeskSpec's own `totalEstimatedSavings` line (the sheet's one declared
 * number, verbatim -- types.ts's own doc comment) and `monthlyEffortProfile`
 * (the SPOC's own free-text effort breakdown, also verbatim). This is the
 * SAME field and the SAME sourcing Offer Desk's own Hours page already
 * uses for its declared 95 (lib/offerDeskWorkRecord.ts's declaredHoursLabel
 * is OFFER_DESK_TOTAL_SAVINGS, the identical string this module reads via
 * DeskSpec.totalEstimatedSavings for Offer Desk) -- extended uniformly to
 * the other five desks, not a new methodology invented for this slice.
 *
 * No defended figure is computed for any desk here, Offer Desk included --
 * that stays 95 vs 61.8 on OfferDeskHours.tsx, untouched. This module only
 * ever produces one number per desk: what the sheet itself states. */
import { ALL_DESKS } from "./index";
import type { DeskSpec } from "./types";

export type DeskHours = {
  desk: DeskSpec;
  /** Verbatim "TOTAL ESTIMATED SAVINGS" line. */
  raw: string;
  /** Parsed low/high hrs/mo from that line's own leading (or, where more
   * than one figure appears — HRBP's own "per HRBP" vs "across team" — its
   * LAST) "~N" or "~N-M hrs/mo" figure. null when the line doesn't state
   * one in that shape (never invented as a fallback). */
  parsed: { low: number; high: number } | null;
};

const HRS_PER_MONTH_RE = /~?(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\s*hrs\/mo/gi;

export function parseHrsPerMonth(text: string): { low: number; high: number } | null {
  const matches = [...text.matchAll(HRS_PER_MONTH_RE)];
  if (matches.length === 0) return null;
  // HRBP's own line states two figures ("~30-50 hrs/mo per HRBP (~90-150
  // hrs/mo across team)") -- the LAST one is the desk-wide figure
  // comparable to every other desk's own single, desk-wide number; every
  // other desk's line only ever has one match, so "last" is also "only."
  const last = matches[matches.length - 1];
  const low = parseFloat(last[1]);
  const high = last[2] !== undefined ? parseFloat(last[2]) : low;
  return { low, high };
}

export function deskHoursSummary(): DeskHours[] {
  return ALL_DESKS.map((desk) => ({
    desk,
    raw: desk.totalEstimatedSavings,
    parsed: parseHrsPerMonth(desk.totalEstimatedSavings),
  }));
}

/** Sums the parsed low/high across every desk whose line parsed cleanly.
 * Returns null only if nothing parsed at all (never happens today — all
 * six desks state a "~N hrs/mo" figure — but this stays honest if that
 * ever changes rather than silently summing zero desks as if it were the
 * whole family). Desks that didn't parse are named separately so the total
 * never silently under-counts without saying so. */
export function sumDeclaredHours(rows: DeskHours[]): { low: number; high: number; unparsedDeskNames: string[] } | null {
  const parsed = rows.filter((r) => r.parsed !== null);
  if (parsed.length === 0) return null;
  const low = parsed.reduce((sum, r) => sum + r.parsed!.low, 0);
  const high = parsed.reduce((sum, r) => sum + r.parsed!.high, 0);
  const unparsedDeskNames = rows.filter((r) => r.parsed === null).map((r) => r.desk.name);
  return { low, high, unparsedDeskNames };
}

export function formatHoursRange(range: { low: number; high: number }): string {
  return range.low === range.high ? `${range.low}` : `${range.low}–${range.high}`;
}
