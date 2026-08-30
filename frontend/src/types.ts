export type Page<T> = { total: number; items: T[] };

export type Health = { status: string; version: string; db_ready: boolean };

export type EntityType = {
  id: number;
  name: string;
  kind: string;
  description: string;
  state_machine: string;
};

export type Entity = {
  id: number;
  type_id: number;
  external_ref: string;
  current_state: string;
  provenance: string;
};

export type EntityEdge = {
  id: number;
  source_id: number;
  target_id: number;
  relation_type: string;
  kind: string;
  provenance: string;
};

export type WorkUnit = {
  id: number;
  code: string;
  name: string;
  business_object_type_id: number;
  current_condition: string;
  desired_condition: string;
  context: string;
  trigger: string;
  inputs: string;
  authority: string;
  actor_constraints: string;
  acceptance_criteria: string;
  evidence_required: string;
  verification_method: string;
  sla_hours: number;
  failure_semantics: string;
  regulatory_entry_id: number | null;
  provenance: string;
  owner: string;
  actor_type: string;
  status: string;
  autonomy_level: number;
  is_sustaining: boolean;
  machine_readable: boolean;
  missing_attributes: string[];
  client_id?: number | null;
};

export type WorkEdge = {
  id: number;
  source_id: number;
  target_id: number;
  edge_type: string;
};

export type Verdict = {
  id: number;
  work_unit_id: number;
  verifiability: number;
  evidence: number;
  reversibility: number;
  determinism: number;
  impact_scope: number;
  compliance: number;
  tacitness: number;
  recommended_level: number;
  applied_gates: string;
  allocation: string;
  origin?: string | null;
  mean: number | null;
  uncapped_level: number | null;
  level_name: string | null;
};

export type CostProfile = {
  id: number;
  work_unit_id: number;
  executions_per_month: number;
  minutes_per_execution: number;
  verification_minutes: number;
  failure_rate: number;
  exception_minutes: number;
  maintenance_hours: number;
  attribution_confidence: number;
  origin?: string;
  computed: Record<string, number | null | Record<string, number>> | null;
};

export type Regulatory = {
  id: number;
  regulation: string;
  clause: string;
  control_objective: string;
  requires_licensed_human: boolean;
};

export type Trace = {
  id: number;
  source_system: string;
  kind: string;
  object_ref: string;
  payload: string;
  imported_at: string;
  provenance: string;
};

export type Intent = { id: number; kind: string; title: string; body: string; provenance: string };

export type Candidate = {
  id: number;
  name: string;
  origin: string;
  provenance: string;
  payload: string;
  sampling_bias_note: string;
  status: string;
  work_unit_id: number | null;
};

export type Gap = {
  id: number;
  kind: string;
  description: string;
  discovered_ref: string;
  declared_ref: string;
  work_unit_id: number | null;
};

export type VerificationRun = {
  id: number;
  work_unit_id: number;
  method: string;
  independent: boolean;
  outcome: string;
  evidence_ref: string;
  actor_ref: string;
  notes: string;
  ran_at: string;
};

export type AutonomyChange = {
  id: number;
  work_unit_id: number;
  kind: string;
  from_level: number;
  to_level: number;
  reason: string;
  approved_by: string;
  created_at: string;
};

export type SpecCheck = {
  id: number;
  work_unit_id: number;
  check_type: string;
  result: string;
  reason: string;
  caller: string;
  created_at: string;
};

export type GraphProjection = {
  nodes: { id: number; code: string; name: string }[];
  edges: { id: number; source_id: number; target_id: number; edge_type: string }[];
};

export type AllocationItem = {
  id: number;
  code: string;
  owner: string;
  actor_type: string;
  autonomy_level: number;
  autonomy_name: string | null;
  recommended_level: number | null;
  allocation: string;
  gates: string;
  origin?: string | null;
};

export type EconomicsProjection = {
  totals: { gross_hours: number; attributed_hours: number; fte: number };
  items: Array<Record<string, string | number | null>>;
};

export const KINDS = ["business_object", "actor", "capability", "resource", "policy", "state"] as const;
export const RELATION_KINDS = ["semantic", "structural"] as const;
export const EDGE_TYPES = ["sequence", "shared_object", "shared_resource", "reciprocal"] as const;
export const METHODS = [
  "deterministic_rule",
  "database_constraint",
  "cross_system_reconciliation",
  "human_spot_check",
  "llm_as_judge",
  "outcome_delay",
  "counterparty_confirmation",
] as const;
export const ACTOR_TYPES = ["human", "agent", "deterministic", "external"] as const;
export const PROVENANCE = ["observed", "declared", "inferred", "designed"] as const;
export const TRACE_KINDS = [
  "log",
  "email",
  "ticket",
  "transcript",
  "erp_event",
  "process_mining",
  "interview",
  "shadowing",
] as const;
export const INTENT_KINDS = ["policy", "sop", "okr", "regulation", "job_description", "contract"] as const;
export const ORIGINS = ["upward", "downward"] as const;
export const GAP_KINDS = [
  "shadow_process",
  "policy_violation",
  "missing_acceptance",
  "workaround",
  "undeclared",
  "unimplemented",
] as const;
export const OUTCOMES = ["passed", "failed", "inconclusive"] as const;
export const CHECK_TYPES = ["authority", "evidence", "condition", "acceptance"] as const;
export const VERDICT_KEYS = [
  "verifiability",
  "evidence",
  "reversibility",
  "determinism",
  "impact_scope",
  "compliance",
  "tacitness",
] as const;

// Scout Elevated V2 PR1
export const INTERVIEW_TYPES = ["founder", "sme"] as const;

export type ScoutCapturedUnit = {
  id: number;
  name: string;
  inputs: string;
  outputs: string;
  systems: string;
  frequency: string;
  time_minutes: number | null;
  pain: string;
  handoffs: string;
  decision_rule: string;
  created_at: string;
  updated_at: string;
};

export type ScoutDimension = {
  key: string;
  label: string;
  captured: number;
  expected: number;
  pct: number;
  computed: boolean;
};

export type ScoutSession = {
  id: number;
  type: (typeof INTERVIEW_TYPES)[number];
  interviewee_name: string;
  status: "in_progress" | "completed";
  completeness_pct: number;
  consent_receipt_id: number | null;
  dimensions: ScoutDimension[];
  units: ScoutCapturedUnit[];
  created_at: string;
  updated_at: string;
};
