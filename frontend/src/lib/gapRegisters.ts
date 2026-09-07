/** F1/F2 (docs/BUILD_PROGRAM.md EVIDENCE-GAP): buckets the eight real
 * GapKind values (backend/app/models/discovery.py::GapKind) into three
 * plain-language registers -- missing / uncertain / contradictory -- so
 * Evidence (step 3) can show counts without inventing a coverage %.
 *
 * Not a new detector: every count this produces comes from GET
 * /discovery/gaps, the same ConformanceGap rows Gates 6/9/10 and the census
 * SOP scan already write (services/genome_import.py, services/census.py,
 * services/discovery.py). This module only groups kinds that already exist.
 *
 *  - undeclared / missing_acceptance / unimplemented: a claim with nothing
 *    behind it yet -- no file, no corroborating unit, no matching record.
 *  - split_recommended / missing_terminal_state: nothing is wrong or
 *    absent, the shape just isn't resolved -- reads like more than one job,
 *    or never reaches a finish line.
 *  - policy_violation / workaround / shadow_process: two records disagree
 *    about the same thing.
 * An unmapped future GapKind defaults to "uncertain" rather than crashing
 * this page -- a schema addition should never silently vanish from a
 * count. */
export type GapRegister = "missing" | "uncertain" | "contradictory";

const REGISTER_BY_KIND: Record<string, GapRegister> = {
  undeclared: "missing",
  missing_acceptance: "missing",
  unimplemented: "missing",
  split_recommended: "uncertain",
  missing_terminal_state: "uncertain",
  policy_violation: "contradictory",
  workaround: "contradictory",
  shadow_process: "contradictory",
};

export function registerForKind(kind: string): GapRegister {
  return REGISTER_BY_KIND[kind] ?? "uncertain";
}

export const REGISTERS: readonly GapRegister[] = ["missing", "uncertain", "contradictory"];

export function countRegisters(gaps: ReadonlyArray<{ kind: string }>): Record<GapRegister, number> {
  const counts: Record<GapRegister, number> = { missing: 0, uncertain: 0, contradictory: 0 };
  for (const g of gaps) counts[registerForKind(g.kind)] += 1;
  return counts;
}

/** Guest has no tenant, so these three counts replay the same four
 * illustrative declared-vs-sitting rows already used on Gap (GAP_ROWS in
 * offerDeskWorkRecord.ts) -- not a live query, not a second illustrative
 * set invented for this page. "What the work is" and "Document check" both
 * describe detail the sitting holds that the declared/upstairs sentence
 * never named (missing); "System of record" is a direct disagreement about
 * which system holds truth (contradictory); "Hours saved" is two numbers
 * for the same month with no single settled figure (uncertain).
 *
 * Lives here (not on CensusEvidence.tsx) so lib/censusExport.ts (CENSUS-PACK
 * P1) can reuse the identical guest counts without a page-to-page import
 * cycle through the census shell every census page renders. */
export const GUEST_REGISTER_COUNTS: Record<GapRegister, number> = { missing: 2, uncertain: 1, contradictory: 1 };

/** One line each: what would close a gap of this register's shape. Plain
 * process language on purpose -- no Darwinbox/Zwayam API, no connector this
 * platform doesn't have. */
export const REGISTER_COPY: Record<GapRegister, { label: string; simple: string; repair: string }> = {
  missing: {
    label: "Missing",
    simple: "Nothing backs this claim yet — no file, no corroborating unit, no matching record.",
    repair: "Upload a file, or import a corroborating unit, that backs the claim — then re-check.",
  },
  uncertain: {
    label: "Uncertain",
    simple:
      "Something is here, but its shape isn't settled — reads like more than one job, or the process never reaches a finish line.",
    repair: "Split the unit into its distinct parts, or name the unit that is this object's real finish line.",
  },
  contradictory: {
    label: "Contradictory",
    simple: "Two records disagree about the same thing — different owners, or different outcomes.",
    repair: "Pick one owner or one outcome for the unit, and correct the other record to match.",
  },
};
