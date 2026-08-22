# Work Engineering

The specification layer between enterprise intent and execution (V8). It makes work machine-readable, verifiable, and allocatable, and produces a spec that execution systems (human, agent, deterministic, external) consume — it does not run the work itself.

## Language

**Work Unit**:
The primitive of the discipline: an independently accountable commitment to move one business object from a stated current condition to a stated desired condition. Everything else this system produces is a view of Work Unit records.
_Avoid_: Task, ticket, job.

**Enterprise Graph**:
The current state of business objects, actors, resources, and policies, and how they connect — the "what exists and what state it's in" graph.
_Avoid_: Business graph, entity graph (use "ontology" for the type layer).

**Work Graph**:
Dependencies between Work Units (`work_edges`), distinct from the Enterprise Graph. Confusing the two graphs is the most common modeling error in this domain.
_Avoid_: Task graph, workflow graph.

**Ontology**:
The type layer inside the Enterprise Ecosystem Representation: entity types and what they mean. Instances and connections live in the Enterprise Graph.

**Contract**:
The 18-attribute record that makes a Work Unit machine-readable (`services/contract.py`, `machine_readable`). Attribute 15 (Dependencies) is not a scalar — it's the Work Unit's edges in the Work Graph.
_Avoid_: Spec (see **Spec API** below — a different thing), schema.

**Draft / Reconciled / Authoritative**:
The three states a Work Unit contract moves through. Draft = discovered or declared but not merged. Reconciled = discovered and declared attributes merged. Authoritative = verified and trusted as the record of truth.

**Variant**:
A Work Unit that shares its parent's core contract but differs in context, authority, or verification (e.g. "Resolve Receivable Exception – Domestic" vs "– Cross-Border"). Exists to prevent inventory explosion from near-duplicate units.

**Provenance**:
A tag on a contract attribute — `observed`, `declared`, `inferred`, or `designed` — separating what discovery found from what was invented.

**Regulatory Register**:
The system of record linking a Work Unit to a specific regulation, clause, and control objective. A compliance score with no register entry is an opinion, not a fact.

**VERDICT**:
The rubric that scores seven supply properties of a Work Unit (Verifiability, Evidence, Reversibility, Determinism, Impact scope, Compliance, Tacitness — each 1–5) and derives a recommended autonomy level. It scores; it does not promote.
_Avoid_: Trust score, confidence score.

**Autonomy level**:
One of six levels (L1–L6) a Work Unit is authorised to run at. Derived (recommended) from the VERDICT mean plus four hard gates; authorised separately by a human. VERDICT and failure rates may only lower the authorised level, never raise it.

**Hard gate**:
One of four caps on autonomy that override the VERDICT score regardless of how high it is (e.g. Compliance = 1, or no evidence path, caps at L2). Gates are specified by V8; the uncapped mean-band mapping is this implementation's own design choice.

**Promotion / Demotion**:
Moving a Work Unit's authorised autonomy level. Promotion is always a human decision, one level at a time, gated on run count and pass rate. Demotion is automatic, triggered by fail rate.

**Spec API**:
The runtime surface (`X-Spec-Key`) that execution systems query to check authority, evidence, condition, and acceptance before acting on a Work Unit. This is what makes governance real rather than documentation — the enforcement point, not the contract itself.
_Avoid_: API (too generic — this term means specifically the governance-enforcement surface).

**Trajectory**:
A logged record of an agent's execution steps against a Work Unit, the ingest point for Execution Layer 3 (Observability & Trajectory Audit).

**Discovery**:
The process that surfaces Work Unit candidates from traces (observed behaviour) and derives them from declared intent, upward and downward respectively.

**Conformance gap**:
The discrepancy between declared policy (what a Work Unit contract says should happen) and observed behaviour (what the Enterprise Graph traces show actually happened).

**Owner vs Actor**:
Two distinct roles on a Work Unit — `owner` is who is accountable for the outcome; `actor_type` is what executes it (human, agent, deterministic, external). Conflating these two boundaries is called out in V8 as a real historical mistake.

**Attribution confidence**:
The discipline of only counting hours saved where they can be attributed directly to an eliminated Work Unit, not self-reported estimates. One of the four costing disciplines (H5–H7) that keeps the economics honest rather than flattering.

**Projection**:
One of five read views (inventory, work-graph, verification, allocation, economics) over the same underlying Work Unit records — not separate artifacts, just different lenses on one source of truth.
