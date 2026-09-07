/** P2 -- Handoff completeness (docs/BUILD_PROGRAM.md CENSUS-PACK). Mirrors
 * backend/app/services/handoff.py::check_readiness exactly, the same
 * relationship offerDeskScenarios.ts already has with services/verdict.py --
 * Plan already loads every unit's real WorkUnit + Verdict rows to draw its
 * S1/S2/S3 strip, so replaying the identical rule here renders the same
 * Ready/Not-ready+why without one network round trip per unit.
 *
 * The real enforcement is the backend's own GET /spec/handoff/{code} --
 * this module is a read-only preview over data Plan already has, never the
 * thing a caller could rely on instead of that endpoint. */
import { apiFetch } from "./apiFetch";
import type { HandoffOut, Verdict, WorkUnit } from "../types";

/** The real, enforced check -- GET /spec/handoff/{code}, same 200-with-a-
 * verdict-in-the-body idiom as POST /spec/check's own allow/deny. Plan's
 * per-row badges use unitReadiness() above (a replay, no round trip); this
 * is for the one explicit "check the real bundle" action keyed users can
 * take, so the refusal shown is the server's own, not just this replay. */
export function fetchHandoffBundle(code: string): Promise<HandoffOut> {
  return apiFetch.get<HandoffOut>(`/spec/handoff/${encodeURIComponent(code)}`);
}

// Same two code shapes as services/handoff.py::DUAL_EMPLOYMENT_STOP_CODES --
// the sheet's own stop (offerDeskWorkRecord.ts's DOCUMENT_CHECK_RECORD.stopRule)
// attaches to exactly one real record, Offer Desk sheet step 2.
export const DUAL_EMPLOYMENT_STOP_CODES = new Set(["WU-OD-02", "WU-OD-002"]);

export type Readiness = {
  ready: boolean;
  reasons: string[];
  gates: string[] | null;
  dualEmploymentStopRequired: boolean;
};

function dualEmploymentTextPresent(wu: WorkUnit): boolean {
  const haystack = [wu.failure_semantics, wu.acceptance_criteria, wu.evidence_required, wu.context]
    .join(" ")
    .toLowerCase();
  return haystack.includes("dual employ");
}

function parseGates(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : [];
  } catch {
    return [];
  }
}

/** `wu`/`verdict`: the real rows already loaded for this code, or null when
 * no matching Work Unit exists on this tenant (or for a guest, ever). */
export function unitReadiness(wu: WorkUnit | null, verdict: Verdict | null): Readiness {
  if (!wu) {
    return {
      ready: false,
      reasons: ["No record for this code on this tenant -- nothing to hand off yet."],
      gates: null,
      dualEmploymentStopRequired: false,
    };
  }

  const reasons: string[] = [];
  const gates = verdict ? parseGates(verdict.applied_gates) : null;
  if (!verdict) {
    reasons.push("Not yet scored on VERDICT -- gates unknown, so this cannot honestly be called ready.");
  }

  const dualEmploymentStopRequired = DUAL_EMPLOYMENT_STOP_CODES.has(wu.code);
  if (dualEmploymentStopRequired && !dualEmploymentTextPresent(wu)) {
    reasons.push(
      "This tenant's sheet requires the dual-employment stop on this unit, and the live record no longer states it.",
    );
  }

  return { ready: reasons.length === 0, reasons, gates, dualEmploymentStopRequired };
}
