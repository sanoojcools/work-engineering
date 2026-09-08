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

// F1 (docs/BUILD_PROGRAM.md EVIDENCE-GAP). Mirrors
// backend/app/schemas/files.py::UploadedFileOut/FileBackingOut.
export type FileBacking = {
  work_unit_code: string;
  business_object: string;
  claim: string;
};

export type UploadedFileOut = {
  id: number;
  file_name: string;
  sha256: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
  backs: FileBacking[];
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
  nodes: {
    id: number;
    code: string;
    name: string;
    business_object: string | null;
    owner: string;
    autonomy_level: number;
    verification_method: string;
  }[];
  edges: { id: number; source_id: number; target_id: number; edge_type: string; reason: string }[];
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
// Three organizational altitudes, not Work Unit autonomy L1-L6 (an
// unrelated scale — see docs/Work-Engineering-V8.md Part K). function_head
// (e.g. CHRO): strategic. sub_function_lead (e.g. Head of TA, Head of
// People Ops): functional. sme: operational — unchanged from the
// original two-track design.
export const INTERVIEW_TYPES = ["function_head", "sub_function_lead", "sme"] as const;
export const INTERVIEW_TYPE_LABELS: Record<(typeof INTERVIEW_TYPES)[number], string> = {
  function_head: "Function Head",
  sub_function_lead: "Sub-function Lead",
  sme: "SME",
};

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

// Genome / Business Objects / Ratify / Automation Index (V8 delivery side)
export type GenomeSummary = {
  version_id: number;
  gqs: number | null;
  ratified: boolean;
  work_unit_count: number;
  work_units: WorkUnit[];
};

export type BusinessObject = {
  name: string;
  work_unit_count: number;
  ratified: boolean;
  state_machine: string[];
  needs_state_machine: boolean;
};

export type BusinessObjectsOut = { version_id: number; business_objects: BusinessObject[] };

export type BoWorkUnit = {
  id: string;
  name: string;
  current_condition: string;
  desired_condition: string;
  time_per_case_min: number | null;
  autonomy: number | null;
  provenance: { file_id: string | null; row: number | null; hash_sha256: string | null };
};

export type WorkUnitFull = {
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
  sla_hours: number | null;
  dependencies: string[];
  failure_semantics: string;
  regulatory_register_link: string[];
  provenance: {
    source_type: string;
    file_id: string | null;
    row: number | null;
    hash_sha256: string | null;
    interview_ref: string;
  };
};

export type BottleneckRow = {
  authority_redacted: string;
  wu_count: number;
  hours_per_day: number;
  bus_factor_1: boolean;
  wu_ids: string[];
};

export type AutomationIndex = {
  version_id: number;
  L1_count: number; L2_count: number; L3_count: number;
  L4_count: number; L5_count: number; L6_count: number;
  verdict_missing_count: number;
  total_hours_current: number;
  total_hours_saveable: number;
  highest_value_targets: string[];
  cost_per_verified_unit: number | null;
  needs_cost_profile: boolean;
  rule_debt_count: number;
  bottleneck_view: BottleneckRow[];
  work_graph_summary: {
    sequence_edges: number; shared_object_edges: number;
    shared_resource_edges: number; reciprocal_edges: number; reciprocal_computed: boolean;
  };
};

// Scout Elevated upgrade thread, Point 2: function-agnostic selector +
// CHRO Full Stack Blast Radius. HR is the only function with a real
// catalog and real capture behind it -- the others are honest "not built
// yet" placeholders, not fake data (see services/scout_blast_radius.py).
export type BusinessFunctionKey = "hr" | "finance" | "legal" | "sales" | "operations";
export const BUSINESS_FUNCTIONS: { key: BusinessFunctionKey; label: string; active: boolean }[] = [
  { key: "hr", label: "HR", active: true },
  { key: "finance", label: "Finance", active: false },
  { key: "legal", label: "Legal", active: false },
  { key: "sales", label: "Sales", active: false },
  { key: "operations", label: "Operations", active: false },
];

export type BlastRadiusItem = {
  key: string;
  name: string;
  cluster: string;
  in_scope: boolean;
  owner_name: string;
  priority: string;
};

export type BlastRadiusSummary = {
  total_sub_functions: number;
  selected_count: number;
  selected_pct: number;
  total_clusters: number;
  clusters_touched: number;
};

export type BlastRadiusOut = {
  items: BlastRadiusItem[];
  summary: BlastRadiusSummary;
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

// CENSUS-v0 Part B: one named cross-desk journey (this slice ships one --
// Offer Desk -> Onboarding). Mirrors backend/app/schemas/work_system.py::WorkSystemOut.
export type WorkSystem = {
  id: number;
  code: string;
  name: string;
  entry: string;
  exit: string;
  owner: string;
  outcome: string;
  status: "candidate" | "ratified";
  ratified_by: string;
  ratified_at: string | null;
  created_at: string;
  function_intent: IntentOut;
  work_system_intent: IntentOut;
};

// D -- INTENT-LITE. Mirrors backend/app/schemas/work_system.py::IntentOut.
// Named IntentOut, not Intent -- `Intent` above (line 117) already mirrors
// the unrelated, already-shipped IntentSource (Box 2 "downward" discovery
// intent, docs/INTENT_CONTRACT.md); this is a different concept (the two
// D -- INTENT-LITE intents attached to a WorkSystem row), not a rename of
// that one. `label` is the function's outcome sentence (Function intent) or
// the journey's purpose sentence (Work System intent) -- the two intents
// don't share a field name, so this type names it generically, same as the
// backend schema's own comment explains. `measure` is populated only for
// Function intent; Work System intent always carries null.
export type IntentOut = {
  label: string;
  owner: string;
  measure: string | null;
  status: "draft" | "confirmed";
  confirmed_by: string;
  confirmed_at: string | null;
};

// E -- PLAN, moderation log. Mirrors backend/app/schemas/moderation.py::ModerationEntryOut.
export type ModerationEntry = {
  id: number;
  work_unit_code: string;
  from_level: number;
  to_level: number;
  reason: string;
  moderated_by: string;
  created_at: string;
};

// P2 (docs/BUILD_PROGRAM.md CENSUS-PACK), GET /api/spec/handoff/{code}.
// Mirrors backend/app/schemas/handoff.py::HandoffOut.
export type HandoffOut = {
  work_unit_code: string;
  ready: boolean;
  reasons: string[];
  verification_method: string | null;
  gates: string[] | null;
  dual_employment_stop_required: boolean;
  bundle: WorkUnit | null;
};

// V10-1 FRONTEND. Mirrors backend/app/schemas/censuses.py::ReadinessOut /
// CensusOut. Readiness is computed live on every GET/POST — never stored,
// never a fabricated "documents received" flag.
export type CensusReadiness = {
  consent: boolean;
  consent_receipt_count: number;
  people: boolean;
  people_seats_filled: number;
  people_seats_total: number;
  docs: boolean;
  docs_uploaded_count: number;
};

export type CensusRecord = {
  id: number;
  client_id: number;
  work_system_id: number;
  status: "draft" | "started";
  scope: Record<string, unknown>;
  document_requests: unknown[];
  created_at: string;
  updated_at: string;
  started_at: string | null;
  readiness: CensusReadiness;
};

/** V10-2. Mirrors backend/app/schemas/pointers.py::FieldPointerOut.
 * `status` is what stands after the resolver ran; `requested_status` is
 * what the caller claimed. They diverge when a broken pointer was
 * downgraded. The UI must display `status`, never treat an unopened
 * pointer as a fact. */
export const POINTER_STATUSES = [
  "observed",
  "declared",
  "reconstructed",
  "composed",
  "predicted",
] as const;
export type PointerStatus = (typeof POINTER_STATUSES)[number];

export type FieldPointer = {
  id: number;
  work_unit_id: number;
  field_name: string;
  requested_status: PointerStatus;
  status: PointerStatus;
  file_id: number | null;
  page: number | null;
  line: number | null;
  cell: string | null;
  quote: string;
  resolved: boolean;
  resolution_note: string;
  gap_id: number | null;
  created_at: string;
  updated_at: string;
};

// Slice 2.1: consent receipts, POST /api/consent/receipts. Mirrors
// backend/app/schemas/consent.py::ConsentReceiptOut.
export type ConsentReceipt = {
  id: number;
  subject_id: string;
  purpose: string;
  consented_at: string;
  expires_at: string | null;
  status: "active" | "withdrawn" | "purged";
  revoked_at: string | null;
  purged_at: string | null;
};
