/** FAMILY-GENOME: one import payload built from all six DeskSpecs, using
 * the same POST /genome/import pipeline and the same GQS>=90 gate Offer
 * Desk's own evidence pack faces (services/genome_import.py,
 * services/gqs.py) — no relaxed path, no second pipeline.
 *
 * Every field is derived from a desk's own real, already-transcribed
 * DeskStep/DeskSpec data (lib/desks/*.ts) — nothing paraphrased in from
 * outside those files. provenance.source_type is "declared" on every unit,
 * with no exception for Onboarding/Offboarding: "finalized" (desks/README.md)
 * describes the workflow documentation, not an observed system-of-record
 * log — this repo has no Darwinbox/Zwayam/Job Vite ingestion path, so
 * nothing here is upgraded to "observed" by being copied into this genome.
 * That is what keeps this payload's Observed% structurally at 0 and GQS
 * (Observed% * 0.4 of the score) well under the 90 gate — not a coincidence,
 * the point of this module.
 *
 * A handful of the 18 required attributes have no direct column on
 * DeskStep (acceptance_criteria, evidence_required, failure_semantics,
 * decision branches) -- the sheets were built as a Time & Motion Study, not
 * an 18-attribute contract capture. Rather than paraphrase whatHappens into
 * something that sounds like a real criterion, these use one honest,
 * literal placeholder, same idiom services/scout_genome.py already
 * established (NOT_CAPTURED) for the same reason: a genome should score as
 * thin as the source genuinely is, not be dressed up to look more complete. */
import { ALL_DESKS, DESKS_BY_ID } from "./index";
import { CROSS_DESK_HANDOFFS } from "./functionGraph";
import type { DeskSpec, DeskStep } from "./types";

const NOT_ON_SHEET =
  "Not its own column in the Time & Motion Study sheet -- needs a follow-up question.";

const DESK_CODE_PREFIX: Record<string, string> = {
  "offer-desk": "OD",
  onboarding: "ONB",
  offboarding: "OFF",
  "vendor-mgmt": "VEN",
  "us-hr": "US",
  hrbp: "HRBP",
};

export type WorkUnitImport = {
  id: string;
  name: string;
  business_object: string;
  current_condition: string;
  desired_condition: string;
  context: { decision_branches: string; variants: string[] };
  trigger: string;
  input: string[];
  authority: string;
  actor_constraints: string;
  acceptance_criteria: string[];
  evidence_required: string[];
  verification_method: string;
  sla_timing: {
    time_per_case_min: number | null;
    frequency: string | null;
    volume_per_month: number | null;
    sla_deadline: string | null;
    raw: string | null;
  };
  dependencies: string[];
  failure_semantics: string;
  regulatory_register_link: string[];
  provenance: { source_type: "declared"; notes: string };
};

export type FamilyGenomePayload = { work_units: WorkUnitImport[] };

/** desk step ids are the sheet's own scheme: plain "1".."26" for five
 * desks, or HRBP's own "OB-"/"OFF-"/"GR-" cluster prefixes (types.ts's own
 * doc comment on DeskStep.id) -- HRBP's 11 steps are genuinely three
 * independent sub-processes (onboarding overlay, offboarding overlay,
 * grievance), not one 11-step chain, so "sequence within desk" is computed
 * per cluster, not across the whole sheet. Grouping by the leading
 * alphabetic prefix (falling back to one group per desk when a step's id
 * has none) gets this right for all six desks without an HRBP-specific
 * branch: the other five desks' plain numeric ids share no such prefix, so
 * they collapse to a single chain exactly as before. */
function stepGroupKey(stepId: string): string {
  const m = /^([A-Za-z]+)-/.exec(stepId);
  return m ? m[1] : "_";
}

function unitCode(deskId: string, position: number): string {
  const prefix = DESK_CODE_PREFIX[deskId];
  if (!prefix) throw new Error(`No WU code prefix registered for desk '${deskId}'`);
  // 3-digit, not 2: services/demo.py's ensure_catalog_hr clones a fixed
  // 12-unit generic HR census onto every client at bootstrap, using
  // 2-digit WU-ONB-01..07 / WU-OFF-01..05 codes for an unrelated, older,
  // coarser SOP sample. work_units is UNIQUE (client_id, code); 3-digit
  // codes here are a different string from those even where the number
  // would otherwise collide, so this genome can be imported into the same
  // tenant as that census without colliding with it -- confirmed live
  // against a real Postgres client already carrying that seed.
  return `WU-${prefix}-${String(position).padStart(3, "0")}`;
}

/** The one place a family-genome import overrides "depends on the previous
 * step in this desk" with a cross-desk dependency instead -- exactly the
 * three handoffs already drawn on the function graph (functionGraph.ts's
 * own CROSS_DESK_HANDOFFS is the single source for which desk pairs those
 * are; this only adds which STEP within each desk anchors the edge).
 * Verified against each desk's own step text, not guessed:
 *  - Offer Desk step 9 ("Place documents & notify onboarding team") is the
 *    step whose own title names the handoff; the handoff's own trigger
 *    ("After all steps complete") does not point at a differently-themed
 *    step (11 is the drop-out exception path, not a completion step).
 *  - Offboarding step 5 ("HRHub (HRBP) discussion") and HRBP step "OFF-1"
 *    ("Voluntary resignation -- HRBP discussion") name the same real event
 *    from each desk's own side.
 *  - Offboarding step 6 ("Separation details confirmed") is the step
 *    immediately after step 5, matching the return handoff's own trigger
 *    ("After HRBP discussion").
 *  - Vendor Mgmt's sheet names no dedicated conversion step, so its last
 *    step (14, "Consultant onboarding" -- the closest topical step, and
 *    genuinely the sheet's last) anchors the source side; Offer Desk's own
 *    step 1 is its natural re-entry point (OFFER_DESK_META lists
 *    "Conversion (contractor -> FT)" as one of the hire types its own
 *    step-1-onward flow already handles).
 * A dependency this adds is additional to, not a replacement for, a
 * target step's own in-desk predecessor where one exists (Offboarding step
 * 6 keeps its dependency on step 5 AND gains HRBP's OFF-1 -- two real,
 * distinct reasons it can't start) -- except for a desk's own first step,
 * which has no in-desk predecessor to keep. */
const HANDOFF_STEP_ANCHORS: Record<string, { fromStepId: string; toStepId: string }> = {
  "offer-desk->onboarding": { fromStepId: "9", toStepId: "1" },
  "offboarding->hrbp": { fromStepId: "5", toStepId: "OFF-1" },
  "hrbp->offboarding": { fromStepId: "OFF-1", toStepId: "6" },
  "vendor-mgmt->offer-desk": { fromStepId: "14", toStepId: "1" },
};

export type CrossDeskDependency = {
  fromDeskId: string;
  fromStepId: string;
  fromCode: string;
  toDeskId: string;
  toStepId: string;
  toCode: string;
  citedFrom: string;
};

function stepCode(deskId: string, stepId: string, codesByDeskAndStep: Map<string, string>): string {
  const key = `${deskId}::${stepId}`;
  const code = codesByDeskAndStep.get(key);
  if (!code) throw new Error(`Handoff anchor step '${stepId}' not found on desk '${deskId}' — source data changed?`);
  return code;
}

/** Resolves HANDOFF_STEP_ANCHORS against CROSS_DESK_HANDOFFS (functionGraph.ts's
 * own list of the three sheet-named handoffs) so this module can never
 * silently invent a fourth edge or drop one of the three -- a mismatch
 * between the two lists throws at build time instead of importing quietly
 * wrong. Exported so both the family-genome import screen and the function
 * graph page render the identical four directional edges (offboarding <->
 * hrbp is two of the three named handoffs, drawn as two directional
 * dependencies) from one computation. */
export function crossDeskDependencies(codesByDeskAndStep: Map<string, string>): CrossDeskDependency[] {
  if (CROSS_DESK_HANDOFFS.length !== Object.keys(HANDOFF_STEP_ANCHORS).length) {
    throw new Error(
      `CROSS_DESK_HANDOFFS has ${CROSS_DESK_HANDOFFS.length} entries but familyGenome.ts has step anchors for ${Object.keys(HANDOFF_STEP_ANCHORS).length} -- these must name the same handoffs.`,
    );
  }
  return CROSS_DESK_HANDOFFS.map((h) => {
    const key = `${h.fromDeskId}->${h.toDeskId}`;
    const anchor = HANDOFF_STEP_ANCHORS[key];
    if (!anchor) throw new Error(`No step-level anchor registered for handoff '${key}'`);
    return {
      fromDeskId: h.fromDeskId,
      fromStepId: anchor.fromStepId,
      fromCode: stepCode(h.fromDeskId, anchor.fromStepId, codesByDeskAndStep),
      toDeskId: h.toDeskId,
      toStepId: anchor.toStepId,
      toCode: stepCode(h.toDeskId, anchor.toStepId, codesByDeskAndStep),
      citedFrom: h.citedFrom,
    };
  });
}

function buildUnit(desk: DeskSpec, step: DeskStep, prevInGroup: DeskStep | null, code: string): WorkUnitImport {
  const clip80 = (s: string) => (s.length <= 80 ? s : s.slice(0, 79) + "…");
  return {
    id: code,
    name: step.name,
    // Each desk is its own real, distinct business process -- desk.name is
    // the sheet's own workflow name (short form), not invented.
    business_object: desk.name,
    current_condition: clip80(prevInGroup ? prevInGroup.name : desk.trigger),
    desired_condition: clip80(step.name),
    context: { decision_branches: "", variants: [] },
    trigger: prevInGroup ? `Step ${prevInGroup.id} complete: ${prevInGroup.name}` : desk.trigger,
    // The step's own "System" cell -- what the step is actually done
    // through, the closest real DeskStep field to "input."
    input: [step.system],
    authority: step.spoc,
    // automationTag ("Human-only" / "Partially automatable" / "Fully
    // automatable") is a real, sheet-stated constraint on which actor type
    // may perform this step -- not relabelled busywork.
    actor_constraints: step.automationTag,
    acceptance_criteria: [NOT_ON_SHEET],
    evidence_required: [NOT_ON_SHEET],
    verification_method: "human spot check",
    sla_timing: {
      time_per_case_min: null, // free-text ranges ("5-10 mins") aren't safely reducible to one float without inventing precision
      frequency: step.volumePerMonth || null,
      volume_per_month: null,
      sla_deadline: null,
      raw: step.timePerCase || null,
    },
    dependencies: [], // filled by the caller once the whole desk's codes are known
    failure_semantics: NOT_ON_SHEET,
    regulatory_register_link: [],
    provenance: {
      source_type: "declared",
      notes: `Trianz Time & Motion Study, May 2026 -- ${desk.interviewSource} (${desk.sourceFile})`,
    },
  };
}

/** Builds the whole family genome: every desk's steps, in the sheet's own
 * order, with sequence dependencies computed per step-id cluster (see
 * stepGroupKey) and the three sheet-named handoffs layered on top as
 * additional (never replacing an in-desk predecessor, except for a desk's
 * own entry step) dependency entries. Deterministic and pure -- no network
 * call, no random id, safe to call from both the import screen and the
 * function graph page. */
export function buildFamilyGenomePayload(desks: DeskSpec[] = ALL_DESKS): {
  payload: FamilyGenomePayload;
  crossDeskEdges: CrossDeskDependency[];
  unitsByDesk: Record<string, WorkUnitImport[]>;
} {
  const codesByDeskAndStep = new Map<string, string>();
  const unitsByDesk: Record<string, WorkUnitImport[]> = {};

  for (const desk of desks) {
    const units: WorkUnitImport[] = [];
    const lastInGroup: Record<string, DeskStep> = {};
    desk.steps.forEach((step, i) => {
      const code = unitCode(desk.id, i + 1);
      codesByDeskAndStep.set(`${desk.id}::${step.id}`, code);
      const groupKey = stepGroupKey(step.id);
      const unit = buildUnit(desk, step, lastInGroup[groupKey] ?? null, code);
      units.push(unit);
      lastInGroup[groupKey] = step;
    });
    unitsByDesk[desk.id] = units;
  }

  const crossDeskEdges = crossDeskDependencies(codesByDeskAndStep);

  // Second pass: now that every unit and cross-desk anchor exists, wire
  // dependencies -- own in-desk predecessor (a placeholder, non-"WU-"
  // token for a desk's own first step in each cluster) plus any cross-desk
  // handoff landing on that exact step.
  for (const desk of desks) {
    const units = unitsByDesk[desk.id];
    const lastInGroup: Record<string, string> = {};
    desk.steps.forEach((step, i) => {
      const groupKey = stepGroupKey(step.id);
      const deps: string[] = [];
      const predecessorCode = lastInGroup[groupKey];
      if (predecessorCode) deps.push(predecessorCode);
      for (const edge of crossDeskEdges) {
        if (edge.toDeskId === desk.id && edge.toStepId === step.id) deps.push(edge.fromCode);
      }
      if (deps.length === 0) {
        // No in-desk predecessor and no inbound handoff lands here --
        // this cluster's own entry point. Non-"WU-" so it never counts as
        // an orphan_dependency violation (services/gqs.py only flags a
        // WU-*-shaped token), same convention the evidence pack's own
        // WU-OD-01 uses.
        deps.push(`family-genome-entry:${desk.id}:${groupKey}`);
      }
      units[i].dependencies = deps;
      lastInGroup[groupKey] = units[i].id;
    });
  }

  const payload: FamilyGenomePayload = {
    work_units: desks.flatMap((d) => unitsByDesk[d.id]),
  };

  return { payload, crossDeskEdges, unitsByDesk };
}

/** Convenience for callers that only need per-desk unit counts (the import
 * screen's "still lists units/gaps" requirement) without paying for a full
 * payload build more than once per render. */
export function familyGenomeDeskSummary(): Array<{ desk: DeskSpec; unitCount: number }> {
  return ALL_DESKS.map((desk) => ({ desk, unitCount: desk.steps.length }));
}

export { DESKS_BY_ID };
