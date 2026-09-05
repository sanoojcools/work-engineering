# Roadmap decisions — Tracks 4–6 and the 5 blocked No-Cracks Gates

**Status: PROPOSAL — nothing in this document is built.** Written for review with
colleagues before any of it becomes an engineering task. Each section below is
a single strongly-recommended path, not a menu — pick the alternative instead
of the recommendation where you disagree, but the recommendation is my actual
opinion, not a hedge.

Nothing here changes `docs/STATUS.md`'s "what is real" / "what is not built"
lists. Those stay accurate until something below actually ships.

---

## Track 4 — Make it a real product (per-user login, self-serve onboarding, SSO)

**Status: schema scaffolding only, landed.** The `users` table this section
proposes exists (alembic `efc855b7d06a`): `client_id` FK, `external_id`
(provider-agnostic — not `workos_user_id`, so the table doesn't lock in the
provider decision below before it's actually made), `role` (admin/editor/
viewer per the recommendation below), RLS from creation (same
`tenant_isolation` shape as every other tenant table). **Nothing reads or
writes it yet** — no router, no session, no provider call, no login. Built
this far because it's decision-independent (the column shapes don't change
based on which provider gets picked), not because the three decisions below
got made — they haven't, and still need you.

**Recommendation: WorkOS**, layered on top of the existing per-org API key
model rather than replacing it.

**Why WorkOS over the obvious alternatives (Clerk, Auth0, roll-your-own):**
- The buyer this product is built for (V8's own framing: a CHRO, an
  enterprise HR function) will ask for SAML/SSO the moment there's a second
  real customer. WorkOS is built specifically for that B2B-selling-into-
  enterprise moment — unlimited SSO connections on a usage-based free tier,
  SCIM provisioning available when you need it, and a hosted login UI
  (AuthKit) that ships fast.
- Clerk has the best day-one developer experience but gates enterprise SSO
  behind a much higher-priced tier and prices per monthly active user —
  fine for a consumer/prosumer product, a worse fit here.
- Auth0 is the most mature but the heaviest to integrate and the most
  expensive at this stage; there's no capability gap it closes that WorkOS
  doesn't already close for less setup.
- Rolling it ourselves (sessions, password reset, SSO/SAML metadata
  exchange) is real security surface for a two-person-team-sized project to
  own indefinitely. Not recommended at this stage regardless of team size.

**Architecture:** keep `OrgApiKey` exactly as it is for machine-to-machine /
API integration use — it already works and nothing forces its removal. Add a
new `users` table (WorkOS user id, `client_id` FK, `role`) and WorkOS-issued
session JWTs for the web UI. RLS stays keyed on `client_id` as it is today;
a user's `client_id` membership is an *additional* application-layer check
on top of RLS, not a replacement for it.

**Roles for v1 — three, not more:**
- **Admin** — manage users, rotate/revoke org API keys, ratify genomes.
- **Editor** — run Scout sessions, edit blast-radius selections, import
  genomes.
- **Viewer** — read-only across Overview, Work Units, Projections, VERDICT.

**Self-serve onboarding:** a signup flow creates a `Client` row, a first
Admin `user` row, and seeds a genuinely empty tenant — reusing the existing
"Set up the demo" seeding *pattern* (`Overview`'s one-click setup), but
producing an empty real tenant instead of the two demo tenants.

**Rough effort:** 1–2 weeks for a working v1 (WorkOS integration, `users`
table + migration, role checks added to existing routers, onboarding flow).

**Decisions only you and colleagues can make:**
1. Confirm WorkOS vs. Clerk vs. Auth0 — or none of the three or a
   preference already in play internally.
2. Confirm 3 roles is enough for launch, or name a 4th (e.g., a
   read-and-comment role for reviewers who aren't ratifying managers).
3. Confirm org API keys stay live as a parallel, permanent access path
   (recommended) rather than being deprecated once user login exists.

---

## Track 5 — Make function-agnostic real (Finance, Legal, Sales, Operations)

The HR catalog that shipped (44 sub-functions, 6 clusters) came from a
reviewed instruction document — a real source I could transcribe and
correct against. **No equivalent source exists for Finance, Legal, or
Sales**, so nothing below is being claimed as real, reviewed data the way
HR's was. What follows is a **draft catalog per function**, built from
established, citable, public process-taxonomy references — the APQC
Process Classification Framework for Finance and Sales-adjacent process
structure, and common Legal Operations maturity-model category sets for
Legal — structured the same way HR's catalog is (clusters → sub-functions),
so it's ready to drop into the same `CATALOG`/`CLUSTER_NAMES` shape in
`scout_blast_radius.py` once reviewed, corrected, and approved. **Until
that review happens, the product should keep showing these three as
"coming soon" placeholders exactly as it does today** — shipping an
unreviewed draft as if it were HR's caliber of real data would be exactly
the kind of thing this project has been careful not to do.

**Operations is deliberately not drafted.** "Operations" was named as a
fourth placeholder alongside Finance/Legal/Sales in the UI, but unlike
those three it isn't one function — it could mean supply chain, IT
operations, facilities, or general business operations depending on the
company, and a generic catalog built without knowing which would be filler,
not a draft worth reviewing. Recommend deferring it until a specific
pilot customer's actual "Operations" scope is known, rather than inventing
a placeholder catalog just to fill the slot.

### Finance — draft, 36 items across 6 clusters

| Cluster | Sub-functions |
|---|---|
| **Accounting & Controllership** | General ledger & close · Accounts payable · Accounts receivable · Fixed assets & depreciation · Intercompany accounting · Statutory & regulatory reporting |
| **FP&A** | Annual budgeting · Rolling forecast · Management reporting/dashboards · Variance analysis · Business case / ROI modeling · Headcount & workforce planning |
| **Treasury & Cash Management** | Cash positioning & forecasting · Bank account management · Debt & investment management · FX risk management · Working capital management · Payment execution |
| **Tax** | Direct tax compliance · Indirect tax (VAT/GST) compliance · Transfer pricing · Tax provision & reporting · Tax audits & disputes · R&D / incentive credits |
| **Procure-to-Pay** | Vendor onboarding & master data · Purchase requisition & PO issuance · Contract & pricing compliance · Invoice processing & 3-way match · Expense management · Vendor risk & performance |
| **Order-to-Cash / Revenue Assurance** | Order entry & validation · Billing & invoicing · Collections · Revenue recognition · Credit management · Dispute & deduction management |

### Legal — draft, 36 items across 6 clusters

| Cluster | Sub-functions |
|---|---|
| **Contracts & Commercial** | Contract intake & triage · Contract drafting & negotiation · Playbook/template management · Contract repository & obligation tracking · Vendor/supplier agreements · Customer agreements & MSAs |
| **Corporate & Governance** | Entity management · Board & shareholder governance · M&A support · Corporate policy management · Signing authority & delegation · Subsidiary compliance |
| **Compliance & Regulatory** | Regulatory monitoring & horizon scanning · Policy & training compliance · Anti-bribery/corruption (ABC) · Data privacy compliance (GDPR/CCPA etc.) · Licensing & permits · Whistleblower/ethics hotline handling |
| **Intellectual Property** | Trademark filing & portfolio · Patent filing & portfolio · IP licensing · IP infringement monitoring · Trade secret protection · Open-source/software license compliance |
| **Employment Law** | Employment contract review · Workplace investigations · Termination & severance review · Immigration/visa compliance · Labor relations/union matters · Policy handbook legal review |
| **Litigation & Disputes** | Litigation case management · Legal hold & e-discovery · Outside counsel management · Dispute settlement negotiation · Regulatory investigations response · Arbitration/ADR management |

### Sales — draft, 36 items across 6 clusters

| Cluster | Sub-functions |
|---|---|
| **Pipeline & Demand** | Lead qualification (MQL→SQL) · Territory & account planning · Prospecting & outbound · Inbound lead routing · Pipeline hygiene & forecasting · Win/loss analysis |
| **Deal Management** | Quote generation (CPQ) · Contract & pricing approval · Deal desk / non-standard terms · Order booking · Discount & margin governance · Deal closing & handoff to CS |
| **Sales Operations** | CRM data management · Commission & compensation calculation · Sales forecasting & reporting · Territory & quota design · Sales tooling/tech stack admin · Sales process compliance |
| **Customer Success & Renewals** | Onboarding & implementation handoff · Account health monitoring · Renewal management · Upsell/cross-sell · Churn risk mitigation · Customer escalation handling |
| **Partnerships & Channel** | Partner onboarding · Channel deal registration · Partner incentive/rebate management · Co-sell/co-marketing coordination · Partner performance review · Reseller/distributor agreements |
| **Sales Enablement** | Sales training & certification · Playbook & battlecard management · Content/collateral management · Competitive intelligence · Sales tech onboarding · Ramp-time tracking |

**Decisions only you and colleagues can make:** every cell above needs a
domain-expert pass the way HR's did — correcting names, merging/splitting
clusters, and (the part I can't do at all) assigning realistic owners and
priorities. Recommend the same process that produced HR's catalog: someone
who actually runs the function reviews this table line by line before it
becomes code.

---

## Track 6 — The long arc (execution layer, upward/trace-based discovery)

**Recommendation: do not build an execution layer.** This project's own
positioning (V8 C4: "specification layer, not execution") is correct and
should stay that way — an agent that actually performs HR/Finance/Legal
work carries liability, safety, and scope well beyond what this session's
mandate covers, and it's a different product decision, not an engineering
task to scope from here.

**What's actually buildable now: upward/trace-based discovery**, the other
declared-vs-observed arm V8's D1 already names. Scout captures the
*downward*, declared arm (a person tells you what the work is). The
upward arm — what a system of record shows the work actually *is* — has
zero implementation today; `discovery_candidates` and `conformance_gaps`
tables exist in the schema but nothing populates them from a real external
system.

**Recommended first step, scoped as a spike, not the whole system:** one
read-only discovery connector against one system of record — pull a CSV or
API export of ticket data (Jira, ServiceNow, Zendesk — whichever the pilot
customer's HR ops team actually uses day to day), map ticket
categories/fields onto candidate Work Units, and diff that against the
Work Units already declared through Scout for the same business object.
Anything unmatched becomes a `ConformanceGap` (kind=`undeclared` or
`shadow_process`) for human review — never auto-written to the genome
itself. This is deliberately small: prove the upward arm can surface one
real gap on one real dataset before deciding whether it's worth a general
connector framework.

**Decision only you and colleagues can make:** which system to target
first. Recommend picking whichever system the actual pilot customer's HR
function already lives in, since HR is this product's proven wedge —
building a connector for a system nobody on the pilot uses would be a
spike with no one to validate it against.

---

## The 5 blocked No-Cracks Gates

Gates 2, 6, 9, 10, 11 (Scout-Reference.md's original numbering, reconfirmed
current in `docs/Work-Engineering-V8.md` Part K10) were named as needing a
real product decision before they're buildable. Recommendations below —
one gate (11) turns out to need no judgment call at all and could be built
as soon as it's confirmed; the other four need an explicit call on
block-vs-warn before they're built.

### Gate 11 — Playback 1 before Playback 2 — **ready to build, no real decision needed**

`GenomeVersionType` already has exactly the three stages this gate wants:
`inferred` (Playback 1 — after the Function Head interview only),
`detailed` (Playback 2 — after SME + bulk docs, Observed provenance),
`ratified` (final). Recommendation: add a pre-pass check to
`import_genome` — a client's *first* `GenomeVersion` must be `inferred`;
a `detailed` version cannot be created unless an `inferred` version
already exists for that client. That's the whole gate. Recommend building
this one first among the five — it's wiring an enum that already matches
the spec, not inventing a heuristic.

### Gate 6 — F1 Split Rule (a Work Unit naming more than one business object or authority should be split)

Recommendation: **advisory, not blocking, for v1.** During import, flag
(don't reject) any `WorkUnitImport` whose `business_object` field contains
a multi-object delimiter (comma, slash, "and") or whose `authority` names
more than one distinct approver, as a `split_recommended` warning with the
matched reason logged — surfaced to the ratifying manager at Playback
rather than auto-split (auto-splitting silently risks misattributing a
condition to the wrong half of a merged unit). **Decision needed:** should
this ever hard-block like the cycle/consent gates do? Recommend no for
v1 — the heuristic is fuzzy enough that hard-blocking risks false-positive
rejections of real, legitimate imports.

### Gate 9 — BO state machines, closed loop with terminal state

Recommendation: populate `entity_types.state_machine` at import time by
inferring states from the set of `current_condition`/`desired_condition`
values seen across all Work Units sharing a `business_object`, building a
directed graph, and requiring at least one state with no outgoing
transition (a terminal state). **Decision needed:** an exemption threshold
— a business object backed by only 1–2 Work Units can't have a real state
machine inferred from it, so recommend requiring ≥3 Work Units before this
gate applies at all; and whether a business object that fails the check
blocks import (like cycles/consent) or only surfaces as a completeness
warning at Playback. Recommend the latter for v1, same reasoning as
gate 6.

### Gate 10 — Conformance gaps flagged Declared vs. Observed, at import time

Recommendation: for any Work Unit whose `provenance.source_type` is
`"declared"` with no corroborating `"observed"` unit sharing its code in a
prior version, auto-create a `ConformanceGap` row (`kind=undeclared`,
`severity=P2` by default) at import time. This is deliberately distinct
from `/discovery/gaps/scan`, which compares against real trace data —
Track 6's discovery connector, once one exists — since import-time
gap-flagging only ever has the declared side to look at. **Decision
needed:** severity beyond the P2 default needs a business-criticality
signal the schema doesn't have yet (nothing today says a Work Unit is more
important than another). Recommend deferring P0/P1 assignment to manual
triage during ratification until such a signal exists, rather than
guessing at one.

### Gate 2 — Function Pack SDK / question bank 100% mapped to 18 attrs

Recommendation: build the Function Pack SDK as the YAML-based format
already named in the original design (`pack.json`, `business_objects.yaml`,
`question_bank.yaml`, `regulatory_stubs.yaml`, `parser_hints.yaml`,
`verdict_anchors.yaml`) — `question_bank.yaml` maps each interview question
explicitly to one or more of the 18 Work Unit attributes, and a
`scout pack validate` CLI checks 100% attribute coverage before a pack can
load. Recommend building **HR's pack first**, retrofitting the
already-hand-written HR question bank into this format as the reference
implementation — HR is the only function with real, reviewed content
today, and doing this first also gives Track 5's Finance/Legal/Sales
catalogs (once reviewed) a structured format to slot into instead of more
ad hoc code per function. **Decision needed:** none blocking — this is the
one gate here that's really an engineering-scope call (how much of the
5-file SDK to build first) rather than a product-judgment call, so it can
start as soon as there's time allocated, independent of the Finance/Legal/
Sales review above.

---

## Suggested order, once you're back

1. Gate 11 (quick, no judgment call) and the Track 5 domain-expert review
   can happen in parallel — neither blocks the other.
2. Track 4's SSO provider pick, once confirmed, is the next highest-value
   build — everything else stays capped at "colleague demo," not
   "customer-ready," without it.
3. Gates 6/9/10 (all advisory-first per the recommendations above) can
   follow once someone signs off on the warn-vs-block calls.
4. Gate 2 / Function Pack SDK once the HR pack is worth retrofitting into
   it — natural pairing with Track 5's review landing.
5. Track 6's single discovery-connector spike last, once a pilot customer
   and their system of record are known — building it against nothing to
   validate against would be wasted work.
