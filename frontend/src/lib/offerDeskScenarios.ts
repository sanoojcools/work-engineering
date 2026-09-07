import type { Verdict, WorkUnit } from "../types";

/** T3d-S (BUILD_PROGRAM.md, Box 3d artefact): S1 floor / S2 derived / S3
 * ceiling for a real Work Unit's VERDICT.
 *
 * This does not invent a second arithmetic next to
 * backend/app/services/verdict.py -- it replays that module's own two pure
 * functions (base_level's mean->L1-5 bands + its L6 special case, and
 * apply_hard_gates' four caps) against the SAME real seven property scores
 * a human already entered for this unit. S2 (derived) is not recomputed at
 * all -- it is Verdict.recommended_level exactly as the backend returned
 * it. S1 (floor) and S3 (ceiling) replay base_level() against the
 * minimum/maximum of those seven real scores instead of their mean, so
 * they answer "if every property were as weak/strong as this unit's own
 * weakest/strongest one" -- not a fabricated number.
 *
 * The hard gate cap is read back from applied_gates (a real, already-
 * computed field) rather than re-derived from evidence_path_exists /
 * requires_licensed_human, which this module has no access to. The SAME
 * cap is applied to all three scenarios, which is what makes this the
 * enforcement of BUILD_PROGRAM.md's hard rule, not just UI copy promising
 * it: if gate4_evidence fired for this unit's real scores, S3 (ceiling) is
 * capped at L2 exactly like S1 and S2 are -- a ceiling can never show a
 * level that "release offer" would need without evidence existing. */

const PROPERTIES = [
  "verifiability",
  "evidence",
  "reversibility",
  "determinism",
  "impact_scope",
  "compliance",
  "tacitness",
] as const;

export const LEVEL_NAMES: Record<number, string> = {
  1: "L1 human only",
  2: "L2 human-led, agent assists",
  3: "L3 agent-led, human approves",
  4: "L4 agent autonomous, human reviews",
  5: "L5 agent autonomous, exception only",
  6: "L6 fully deterministic",
};

// Mirrors verdict.py::apply_hard_gates' four cap values exactly.
const GATE_CAPS: Record<string, number> = {
  gate1_regulatory: 2,
  gate2_reversibility: 3,
  gate3_impact: 3,
  gate4_evidence: 2,
};

function baseLevelFromMean(mean: number): number {
  if (mean < 2.0) return 1;
  if (mean < 2.75) return 2;
  if (mean < 3.5) return 3;
  if (mean < 4.25) return 4;
  return 5;
}

// Mirrors verdict.py::base_level, L6 special case included.
function baseLevel(scores: Record<string, number>, mean: number): number {
  const level = baseLevelFromMean(mean);
  if (scores.determinism === 5 && scores.verifiability >= 4 && scores.tacitness >= 4 && mean >= 4.5) {
    return 6;
  }
  return level;
}

function capFromAppliedGates(appliedGates: string[]): number {
  let cap = 6;
  for (const g of appliedGates) {
    if (g in GATE_CAPS) cap = Math.min(cap, GATE_CAPS[g]);
  }
  return cap;
}

// Mirrors verdict.py::allocation_for for actor_type="human" (this walk
// never scores an external/buy unit) -- make / agent / automate.
function allocationFor(level: number): string {
  if (level >= 6) return "automate";
  if (level >= 3) return "agent";
  return "make";
}

function parseAppliedGates(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : [];
  } catch {
    return [];
  }
}

export type ScenarioPoint = { level: number; levelName: string; allocation: string };

export type ScenarioStrip =
  | { scored: false }
  | {
      scored: true;
      s1Floor: ScenarioPoint;
      s2Derived: ScenarioPoint;
      s3Ceiling: ScenarioPoint;
      appliedGates: string[];
    };

/** `verdict`: the real VerdictScore row for this Work Unit, or null/undefined
 * if none has ever been recorded. Never pass a fabricated or default row --
 * the whole point is "if scores missing, show not scored." */
export function scenarioStrip(verdict: Verdict | null | undefined): ScenarioStrip {
  if (!verdict) return { scored: false };

  const scores: Record<string, number> = Object.fromEntries(PROPERTIES.map((p) => [p, verdict[p]]));
  const values = PROPERTIES.map((p) => scores[p]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const appliedGates = parseAppliedGates(verdict.applied_gates);
  const cap = capFromAppliedGates(appliedGates);

  const floorLevel = Math.min(baseLevel(scores, min), cap);
  const ceilingLevel = Math.min(baseLevel(scores, max), cap);
  const derivedLevel = verdict.recommended_level;

  return {
    scored: true,
    s1Floor: { level: floorLevel, levelName: LEVEL_NAMES[floorLevel], allocation: allocationFor(floorLevel) },
    s2Derived: {
      level: derivedLevel,
      levelName: verdict.level_name ?? LEVEL_NAMES[derivedLevel],
      allocation: verdict.allocation,
    },
    s3Ceiling: { level: ceilingLevel, levelName: LEVEL_NAMES[ceilingLevel], allocation: allocationFor(ceilingLevel) },
    appliedGates,
  };
}

/** T3b-P (BUILD_PROGRAM.md, Box 3b contract card): field-level provenance
 * for one real Work Unit.
 *
 * WorkUnit.provenance (backend/app/models/workunit.py) is ONE value for
 * the whole row -- there is no per-attribute source_type column, so this
 * cannot show a genuinely independent source per field without inventing
 * one. What it shows instead is real: which of the contract's attributes
 * are actually populated (services/contract.py::missing_attributes, the
 * same shipped signal Document check's own "checkable today" banner
 * already relies on), attributed to this unit's own real provenance value
 * -- and every other source_type bucket at its real count of zero, "if
 * real" per BUILD_PROGRAM.md's own qualifier, not hidden or padded.
 *
 * missing_attributes() checks 16 of the 18 contract attributes -- #15
 * dependencies lives on the Work Graph as an edge, not a scalar field, and
 * #17 regulatory_register_link is intentionally excluded there too (null
 * legitimately means "unregulated", not "missing"). This stays precise
 * about that 16-of-18 scope rather than claiming full 18-attribute
 * coverage it does not check. */

export type SourceTypeCounts = { observed: number; declared: number; inferred: number; designed: number };

export type FieldProvenance =
  | { scored: false }
  | {
      scored: true;
      counts: SourceTypeCounts;
      notYetProvided: string[];
      checkedAttributeCount: 16;
    };

export function fieldProvenance(wu: WorkUnit | null | undefined): FieldProvenance {
  if (!wu) return { scored: false };

  const counts: SourceTypeCounts = { observed: 0, declared: 0, inferred: 0, designed: 0 };
  const populated = 16 - wu.missing_attributes.length;
  const sourceType = wu.provenance as keyof SourceTypeCounts;
  if (sourceType in counts) {
    counts[sourceType] = populated;
  }

  return {
    scored: true,
    counts,
    notYetProvided: wu.missing_attributes,
    checkedAttributeCount: 16,
  };
}
