/** Mandate 1: translate already-computed conditions into one plain sentence
 * each for the Plan / census one-pager. No new tables. No invented risks.
 *
 * Maps only: cycle, split / two owners, missing terminal (if shown today),
 * empty authority or empty acceptance on a named piece, dual-employment
 * stop present. Never maps GQS fail, talk-only, or “not enough in the
 * files” to a compliance risk. ATS/tracker rows are not pieces.
 */
import type { AdmissibilityOut, Gap, GraphProjection, JourneyRefusal, WorkUnit } from "../types";

export const GUEST_RISKS_EMPTY = "none named yet";
export const KEYED_RISKS_EMPTY = "none yet";

export type PlanRiskKind =
  | "dual_employment"
  | "cycle"
  | "split"
  | "no_finish"
  | "empty_authority"
  | "empty_acceptance";

export type PlanRisk = {
  id: string;
  kind: PlanRiskKind;
  sentence: string;
};

export type PlanRiskInput = {
  units: WorkUnit[];
  gaps?: Gap[];
  refusals?: JourneyRefusal[];
  graph?: GraphProjection | null;
};

function blank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function twoOwners(owner: string): boolean {
  const lower = owner.toLowerCase();
  return owner.includes(",") || lower.includes(" and ");
}

function dualEmploymentTextPresent(wu: WorkUnit): boolean {
  const haystack = [wu.failure_semantics, wu.acceptance_criteria, wu.evidence_required, wu.context]
    .join(" ")
    .toLowerCase();
  return haystack.includes("dual employ");
}

function pieceLabel(code: string, name: string): string {
  const n = name.trim();
  return n ? `${code} ${n}` : code;
}

function unitById(units: WorkUnit[], id: number | null): WorkUnit | null {
  if (id == null) return null;
  return units.find((u) => u.id === id) ?? null;
}

function pieceFromGap(gap: Gap, units: WorkUnit[]): { code: string; name: string } | null {
  const matched = unitById(units, gap.work_unit_id);
  if (matched) return { code: matched.code, name: matched.name };
  const ref = (gap.declared_ref || gap.discovered_ref || "").trim();
  if (!ref) return null;
  const byCode = units.find((u) => u.code === ref);
  if (byCode) return { code: byCode.code, name: byCode.name };
  return { code: ref, name: "" };
}

function hasTwoOwnersOnUnit(wu: WorkUnit): boolean {
  return twoOwners(wu.owner || "");
}

/** Sequence-only loops already sitting on this tenant's work graph. */
function sequenceCycles(graph: GraphProjection | null | undefined): string[][] {
  if (!graph) return [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<number, number[]>();
  for (const edge of graph.edges) {
    if (edge.edge_type !== "sequence") continue;
    if (!nodes.has(edge.source_id) || !nodes.has(edge.target_id)) continue;
    const list = outgoing.get(edge.source_id) ?? [];
    list.push(edge.target_id);
    outgoing.set(edge.source_id, list);
  }

  const cycles: string[][] = [];
  const seen = new Set<string>();
  const visiting = new Set<number>();
  const done = new Set<number>();
  const stack: number[] = [];

  const visit = (id: number) => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      if (start >= 0) {
        const loop = stack.slice(start).concat(id);
        const codes = loop.map((nid) => nodes.get(nid)?.code).filter((c): c is string => Boolean(c));
        const key = [...new Set(codes)].sort().join("|");
        if (key && !seen.has(key)) {
          seen.add(key);
          cycles.push([...new Set(codes)]);
        }
      }
      return;
    }
    visiting.add(id);
    stack.push(id);
    for (const next of outgoing.get(id) ?? []) visit(next);
    stack.pop();
    visiting.delete(id);
    done.add(id);
  };

  for (const id of nodes.keys()) visit(id);
  return cycles;
}

function cycleSentence(codes: string[], units: WorkUnit[]): string {
  const labels = codes.map((code) => {
    const wu = units.find((u) => u.code === code);
    return pieceLabel(code, wu?.name ?? "");
  });
  if (labels.length === 1) return `${labels[0]} depends on itself in a loop.`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} depend on each other in a loop.`;
  return `${labels[0]}, ${labels[1]}, and ${labels.length - 2} more depend on each other in a loop.`;
}

/** Pure map. Guest passes empty inputs and must get []. Never invents. */
export function translatePlanRisks(input: PlanRiskInput): PlanRisk[] {
  const units = input.units;
  const gaps = input.gaps ?? [];
  const refusals = input.refusals ?? [];
  const out: PlanRisk[] = [];
  const seen = new Set<string>();

  const add = (kind: PlanRiskKind, id: string, sentence: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, kind, sentence });
  };

  for (const wu of units) {
    if (dualEmploymentTextPresent(wu)) {
      add(
        "dual_employment",
        `dual:${wu.code}`,
        `${pieceLabel(wu.code, wu.name)} names dual employment as a stop.`,
      );
    }
  }

  for (const codes of sequenceCycles(input.graph)) {
    add("cycle", `cycle:${codes.slice().sort().join(">")}`, cycleSentence(codes, units));
  }

  for (const gap of gaps) {
    if (gap.kind === "split_recommended") {
      const piece = pieceFromGap(gap, units);
      if (!piece) continue;
      add("split", `split:${piece.code}`, `${pieceLabel(piece.code, piece.name)} names more than one owner or job.`);
    }
    if (gap.kind === "missing_terminal_state") {
      const piece = pieceFromGap(gap, units);
      if (!piece) continue;
      add("no_finish", `finish:${piece.code}`, `${pieceLabel(piece.code, piece.name)} has no finish we can observe.`);
    }
  }

  for (const row of refusals) {
    const wu = unitById(units, row.work_unit_id) ?? units.find((u) => u.code === row.code);
    const label = pieceLabel(row.code, wu?.name ?? "");
    if (row.reason === "two_owners") {
      add("split", `split:${row.code}`, `${label} names two owners.`);
    }
    if (row.reason === "no_exit") {
      add("no_finish", `finish:${row.code}`, `${label} has no finish we can observe.`);
    }
  }

  for (const wu of units) {
    if (hasTwoOwnersOnUnit(wu)) {
      add("split", `split:${wu.code}`, `${pieceLabel(wu.code, wu.name)} names two owners.`);
    }
    if (blank(wu.authority)) {
      add(
        "empty_authority",
        `authority:${wu.code}`,
        `${pieceLabel(wu.code, wu.name)} has no one named who may decide.`,
      );
    }
    if (blank(wu.acceptance_criteria)) {
      add(
        "empty_acceptance",
        `acceptance:${wu.code}`,
        `${pieceLabel(wu.code, wu.name)} has no stated rule for what counts as done.`,
      );
    }
  }

  const order: PlanRiskKind[] = [
    "dual_employment",
    "cycle",
    "split",
    "no_finish",
    "empty_authority",
    "empty_acceptance",
  ];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.id.localeCompare(b.id));
}

export function admissibilityFrom(data: AdmissibilityOut | null): JourneyRefusal[] {
  return data?.refusals ?? [];
}
