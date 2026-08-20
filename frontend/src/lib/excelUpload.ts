import * as XLSX from "xlsx";
import { ACTOR_TYPES, METHODS } from "../types";

export type ExcelWorkUnitRow = {
  code: string;
  title: string;
  business_object: string;
  owner: string;
  current_condition: string;
  desired_condition: string;
  acceptance_criteria: string;
  evidence: string;
  owner_type: string;
  verification_method: string;
};

type Method = (typeof METHODS)[number];
type Actor = (typeof ACTOR_TYPES)[number];

function cell(row: Record<string, unknown>, ...names: string[]): string {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    map.set(key.trim().toLowerCase().replace(/\s+/g, " "), String(value ?? "").trim());
  }
  for (const name of names) {
    const value = map.get(name.toLowerCase());
    if (value && value.toLowerCase() !== "nan") return value;
  }
  return "";
}

function methodOf(raw: string): Method {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((METHODS as readonly string[]).includes(key)) return key as Method;
  if (key.includes("human") || key.includes("spot")) return "human_spot_check";
  if (key.includes("database") || key === "db") return "database_constraint";
  if (key.includes("recon")) return "cross_system_reconciliation";
  if (key.includes("llm") || key.includes("judge")) return "llm_as_judge";
  if (key.includes("delay")) return "outcome_delay";
  if (key.includes("counter")) return "counterparty_confirmation";
  return "deterministic_rule";
}

function actorOf(raw: string): Actor {
  const key = raw.trim().toLowerCase();
  if ((ACTOR_TYPES as readonly string[]).includes(key)) return key as Actor;
  if (key.includes("agent") || key.includes("robot")) return "agent";
  if (key.includes("deterministic") || key.includes("auto")) return "deterministic";
  if (key.includes("external") || key.includes("bpo")) return "external";
  return "human";
}

export function parseWorkUnitWorkbook(buffer: ArrayBuffer): ExcelWorkUnitRow[] {
  const book = XLSX.read(buffer, { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const rows: ExcelWorkUnitRow[] = [];
  for (const item of raw) {
    const code = cell(item, "code", "id");
    if (!code) continue;
    rows.push({
      code,
      title: cell(item, "title", "name"),
      business_object: cell(item, "business object", "business_object", "object"),
      owner: cell(item, "owner / authority", "owner", "authority"),
      current_condition: cell(item, "current condition", "current_condition", "pre-state"),
      desired_condition: cell(item, "desired condition", "desired_condition", "post-state"),
      acceptance_criteria: cell(item, "acceptance criteria", "acceptance_criteria", "acceptance"),
      evidence: cell(item, "evidence required", "evidence", "evidence_required"),
      owner_type: actorOf(cell(item, "owner type", "actor type", "actor_type")),
      verification_method: methodOf(cell(item, "verification method", "verification_method")),
    });
  }
  return rows;
}

export function clip(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit);
}

export function workUnitPayload(row: ExcelWorkUnitRow, businessObjectTypeId: number) {
  const owner = clip(row.owner, 120);
  return {
    code: clip(row.code, 40),
    name: clip(row.title || row.code, 200),
    business_object_type_id: businessObjectTypeId,
    current_condition: clip(row.current_condition, 80),
    desired_condition: clip(row.desired_condition, 80),
    context: `HR operations · ${row.business_object || "Employee"}`,
    trigger: row.current_condition,
    inputs: row.evidence || row.business_object,
    authority: owner,
    actor_constraints: row.owner_type,
    acceptance_criteria: row.acceptance_criteria,
    evidence_required: row.evidence,
    verification_method: row.verification_method,
    sla_hours: 8,
    failure_semantics: "Hold; notify owner; do not silently retry",
    provenance: "designed",
    owner,
    actor_type: row.owner_type,
  };
}

export function summarizeUpload(created: number, existing: string[], failed: string[]): string {
  const parts = [`Created ${created}`];
  if (existing.length === 1) parts.push(`1 already exists (${existing[0]})`);
  else if (existing.length > 1) parts.push(`${existing.length} already exist (${existing.join(", ")})`);
  if (failed.length === 1) parts.push(`1 failed (${failed[0]})`);
  else if (failed.length > 1) parts.push(`${failed.length} failed (${failed.join(", ")})`);
  return parts.join(", ");
}
