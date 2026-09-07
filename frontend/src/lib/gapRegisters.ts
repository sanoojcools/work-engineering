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
