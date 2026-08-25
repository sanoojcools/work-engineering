import type { WorkUnit } from "../types";

export const FUNCTION_MAP: Record<string, string> = {
  "WU-HR": "HR & People Ops",
  "WU-ONB": "HR & People Ops",
  "WU-OFF": "HR & People Ops",
  "WU-FIN": "Finance & Compliance",
  "WU-OTC": "Sales & O2C",
  "WU-SALES": "Sales & O2C",
  "WU-CS": "Customer Service",
  "WU-TECH": "Tech / Product",
  "WU-OPS": "Ops / Supply Chain",
};

export const FUNCTION_ORDER = [
  "HR & People Ops",
  "Finance & Compliance",
  "Sales & O2C",
  "Customer Service",
  "Tech / Product",
  "Ops / Supply Chain",
] as const;

export const FUNCTION_COLORS: Record<string, string> = {
  "HR & People Ops": "#3B82F6",
  "Finance & Compliance": "#10B981",
  "Sales & O2C": "#F59E0B",
  "Customer Service": "#8B5CF6",
  "Tech / Product": "#6B7280",
  "Ops / Supply Chain": "#A16207",
  Other: "#6b6860",
};

export const INDUSTRY_ORDER = [
  "BFSI",
  "Manufacturing",
  "Healthcare",
  "Retail / E-commerce",
  "IT / SaaS / ITES",
  "Cross-Industry",
] as const;

export type IndustryName = (typeof INDUSTRY_ORDER)[number];
export type FunctionName = (typeof FUNCTION_ORDER)[number] | "Other";

export function getFunction(code: string): FunctionName {
  for (const prefix of Object.keys(FUNCTION_MAP)) {
    if (code.startsWith(prefix)) return FUNCTION_MAP[prefix] as FunctionName;
  }
  return "Other";
}

export function getIndustry(code: string): IndustryName {
  if (code.includes("-BFSI-")) return "BFSI";
  if (code.includes("-MFG-")) return "Manufacturing";
  if (code.includes("-HLTH-")) return "Healthcare";
  if (code.includes("-RETAIL-")) return "Retail / E-commerce";
  if (code.includes("-ITES-")) return "IT / SaaS / ITES";
  return "Cross-Industry";
}

export function provenanceLabel(provenance: string): "Declared" | "Observed" | "Inferred" | "Designed" {
  if (provenance === "declared") return "Declared";
  if (provenance === "observed") return "Observed";
  if (provenance === "inferred") return "Inferred";
  return "Designed";
}

export type IndustryGroup = {
  name: IndustryName;
  units: WorkUnit[];
};

export type FunctionGroupData = {
  name: FunctionName;
  color: string;
  units: WorkUnit[];
  reconciled: number;
  draft: number;
  hours: number;
  industries: IndustryGroup[];
};

export function groupWorkUnits(
  units: WorkUnit[],
  hoursByUnitId: Map<number, number> = new Map(),
): FunctionGroupData[] {
  const byFn = new Map<string, WorkUnit[]>();
  for (const name of FUNCTION_ORDER) byFn.set(name, []);
  for (const unit of units) {
    const fn = getFunction(unit.code);
    if (!byFn.has(fn)) byFn.set(fn, []);
    byFn.get(fn)!.push(unit);
  }
  const names = [...FUNCTION_ORDER, ...[...byFn.keys()].filter((n) => !(FUNCTION_ORDER as readonly string[]).includes(n))];
  return names.map((name) => {
    const list = byFn.get(name) ?? [];
    const byInd = new Map<IndustryName, WorkUnit[]>();
    for (const ind of INDUSTRY_ORDER) byInd.set(ind, []);
    for (const unit of list) {
      const ind = getIndustry(unit.code);
      byInd.get(ind)!.push(unit);
    }
    const industries = INDUSTRY_ORDER.map((ind) => ({
      name: ind,
      units: byInd.get(ind) ?? [],
    })).filter((g) => g.units.length > 0);
    return {
      name: name as FunctionName,
      color: FUNCTION_COLORS[name] ?? FUNCTION_COLORS.Other,
      units: list,
      reconciled: list.filter((u) => u.status === "reconciled" || u.status === "authoritative").length,
      draft: list.filter((u) => u.status === "draft").length,
      hours: list.reduce((sum, u) => sum + (hoursByUnitId.get(u.id) ?? 0), 0),
      industries,
    };
  });
}

export function matchesSearch(unit: WorkUnit, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return true;
  return unit.code.toLowerCase().includes(q) || unit.name.toLowerCase().includes(q);
}

export function highlightMatch(text: string, query: string): { before: string; match: string; after: string } | null {
  const q = query.trim();
  if (q.length < 2) return null;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return null;
  return { before: text.slice(0, idx), match: text.slice(idx, idx + q.length), after: text.slice(idx + q.length) };
}
