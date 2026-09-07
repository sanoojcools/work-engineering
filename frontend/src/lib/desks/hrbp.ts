/** Real data, transcribed verbatim from
 * desks/HRBP_Agent_Ready_Onboarding_Offboarding_GR.xlsx (Session 1: Thamizh
 * Tharagai Pachaiyappan + Rajitha Shaganti, 15 May 2026, HRBP validation
 * session). Per the founder's 21 May 2026 email (desks/README.md), this
 * desk's documentation still needs post follow-up validation -- not
 * finalized like Onboarding/Offboarding. This is HRBP's own involvement in
 * onboarding and offboarding (an overlay, not a third copy of those two
 * desks) plus HRBP's own grievance/WFH work. The sheet uses its own step
 * ids (OB-/OFF-/GR- prefixes) -- kept as-is, not renumbered. The sheet has
 * no "HANDOFF MAP" table of its own (unlike the other five), so
 * `handoffs` is honestly empty here; the real HRBP handoffs this slice
 * draws on the function graph are sourced from Offboarding's own sheet,
 * which names "HRHub (HRBP)" directly. */
import type { DeskHandoff, DeskSpec, DeskStep } from "./types";

const steps: DeskStep[] = [
  {
    id: "OB-1",
    name: "Meet & greet",
    whatHappens:
      "Location HRBP meets new joiner in person on DOJ. Introduces to reporting manager. Checks IT assets (laptop, ID card, access card) allocated. Manager introduces to buddy/team.",
    system: "Physical / In-person",
    timePerCase: "~15-20 min per joiner",
    volumePerMonth: "~28-30/mo (org-wide)",
    automationTag: "Human-only",
    spoc: "Location HRBP",
  },
  {
    id: "OB-2",
    name: "Weekly induction",
    whatHappens:
      "Thamizh schedules weekly Friday induction (1 hour) via Teams. Maintains manual roster tracker assigning HRBPs on rotation. All joiners from Mon-Fri of that week are included. Content: 45-50 slide deck covering org overview, pillars, payroll details, employee benefits, FBP declaration, performance evaluation framework, appraisal framework, mandatory trainings, policy acknowledgement, internal portals, employee handbook, new hire SharePoint portal link. Standard template for ALL grades and hire types (including campus). Always virtual for lateral hires; physical for campus hires at specific location.",
    system: "Teams (virtual call) + PPT",
    timePerCase: "1 hour per session (no prep time needed)",
    volumePerMonth: "~7 joiners/week (all locations combined)",
    automationTag: "Partially automatable",
    spoc: "Thamizh (BU HR)",
  },
  {
    id: "OB-3",
    name: "Post-onboarding touchpoint (discontinued)",
    whatHappens:
      "Previously done as scheduled calls by Thamizh for all joiners across locations. DISCONTINUED. Replaced by: respective BU HRs stay in touch with new joiners within their span informally. Hybrid working made formal touchpoint calls unnecessary.",
    system: "N/A",
    timePerCase: "0",
    volumePerMonth: "N/A",
    automationTag: "Discontinued",
    spoc: "Discontinued — was Thamizh",
  },
  {
    id: "OFF-1",
    name: "Voluntary resignation — HRBP discussion",
    whatHappens:
      "On resignation trigger from Darwinbox, HRBP connects with associate within 24 hours. First-level discussion to understand reason. Follow-up discussion after checking with manager/PM. HRBP updates remarks in Darwinbox and approves workflow. No separate exit interview form in Darwinbox (was in old e-separation tool) — only remarks in the tool.",
    system: "Darwinbox + Teams/Email",
    timePerCase: "~30 min per case (discussion + Darwinbox)",
    volumePerMonth: "~54/mo (org-wide, split across HRBPs by span)",
    automationTag: "Human-only",
    spoc: "HRBP",
  },
  {
    id: "OFF-2",
    name: "Involuntary / termination",
    whatHappens:
      "For disciplinary, conduct violations, policy breaches, PIP failures. PIP: 30-day period — if unsuccessful on day 30, HRBP initiates termination; associate asked to submit resignation in Darwinbox, same-day physical LWD, payroll continues for 60/90 day notice period. Policy violation (confidentiality breach, data leak): immediate termination — delivery manager escalates to HRBP, HRBP + delivery take action together.",
    system: "Darwinbox + Email",
    timePerCase: "~1-2 hrs per case",
    volumePerMonth: "~2-3/quarter",
    automationTag: "Human-only",
    spoc: "HRBP + delivery manager",
  },
  {
    id: "OFF-3",
    name: "Retention process",
    whatHappens:
      "Detailed multi-step process: (1) Delivery/PM identifies critical/niche resource, sends retention justification to HRBP; (2) HRBP connects with associate — reason, competing offer, expected hike %; (3) HRBP checks with TA team for market intelligence; (4) HRBP checks with Talent Mobility for internal pool; (5) HRBP checks with Finance for bill rate + profit margin; (6) HRBP validates internal fitment/parity; (7) inputs compiled and taken to Sanuj for review; (8) Sanuj takes to CHRO (Raja) for approval (mandatory for all retention); (9) on approval, HRBP initiates discussion, resignation revoked in Darwinbox, revised compensation letter issued.",
    system: "Email + Teams + Darwinbox",
    timePerCase: "2-3 weeks per case",
    volumePerMonth: "~10/year (Rajitha), ~3-5/year (Thamizh) — ~13-15/year total",
    automationTag: "Human-only",
    spoc: "HRBP",
  },
  {
    id: "OFF-4",
    name: "Manage-out process",
    whatHappens:
      "(1) Talent Mobility team confirms redundancy list; (2) list shared with Sanuj; (3) Sanuj delegates to respective HRBPs by span; (4) if large wave, distributed across HRBP team; (5) HRBP has face-to-face discussion (preferred) or virtual; (6) associate submits resignation in Darwinbox; (7) HRBP updates as involuntary in backend; (8) physical LWD = resignation day, laptop return within 7 working days; (9) payroll continues until NP-based relieving date; (10) letters processed on relieving date.",
    system: "Darwinbox + Email + Teams",
    timePerCase: "~1-2 hrs per case (discussion + formalities)",
    volumePerMonth: "~4/week (Sasikala's data)",
    automationTag: "Human-only",
    spoc: "HRBP",
  },
  {
    id: "OFF-5",
    name: "NDA follow-up",
    whatHappens:
      "Darwinbox auto-triggers NDA acknowledgement email. HRBP is CC'd. HRBP verifies NDA acknowledged before giving HR clearance. For manage-out: HRBP shares NDA manually as PDF + SharePoint link during discussion (same day). Typical follow-up: 1-2 times before associate completes.",
    system: "Darwinbox (trigger) + SharePoint + Email",
    timePerCase: "~5 min per case",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "HRBP",
  },
  {
    id: "GR-1",
    name: "Daily query handling",
    whatHappens:
      "Employees reach out via Teams chat/call or in-person (walk-in for location HRBPs). Topics: payroll/salary queries, Darwinbox navigation issues, payroll portal issues (FBP/IT declaration), timesheet submission questions, new joiner policy clarifications, benefits queries, appraisal/ratings/hike queries (seasonal — heavy in Q1). HRBP gives first-level answer; if technical/system issue, routes to HR Ops or payroll team via email.",
    system: "Teams (chat/call) + Email",
    timePerCase: "5-15 min per query",
    volumePerMonth: "5-10 per HRBP/day (~150-300/mo across team)",
    automationTag: "Partially automatable",
    spoc: "HRBP",
  },
  {
    id: "GR-2",
    name: "WFH approvals",
    whatHappens:
      "Employees request WFH via email (to manager + HRBP) and/or raise in Darwinbox inbox. HRBP approves in Darwinbox task box. For NYL account: daily WFH requests (strict hybrid mandate), 5-6 approvals per HRBP per day. For longer WFH (>1 week): 3-way discussion (associate + manager + HRBP) before approval. For non-genuine requests: HRBP can reject.",
    system: "Darwinbox (task box) + Email",
    timePerCase: "~2-3 min per approval (~15-30 min/day total)",
    volumePerMonth: "~120-150 approvals/mo per location HRBP",
    automationTag: "Partially automatable",
    spoc: "HRBP",
  },
  {
    id: "GR-3",
    name: "Behavioral/conduct issues",
    whatHappens:
      "Routed from delivery manager/PM to HRBP. HRBP has 1:1 discussion with associate. Warning issued; if repeated, escalation path. Types: RTO non-compliance (most common), availability issues, client escalations, behavioral issues. Policy violation (confidentiality breach/data leak): immediate termination. No formal tracker or SLA for grievance resolution — timeline depends on stakeholder dependencies.",
    system: "Email + Teams",
    timePerCase: "15-30 min per case",
    volumePerMonth: "~2-5 conduct cases/mo; RTO warnings weekly",
    automationTag: "Human-only",
    spoc: "HRBP",
  },
];

const handoffs: DeskHandoff[] = [];

export const HRBP_SPEC: DeskSpec = {
  id: "hrbp",
  name: "HRBP",
  workflowName:
    "HRBP Processes: Onboarding Involvement (Induction + Meet & Greet), Offboarding Involvement (Voluntary, Involuntary, Manage-Out, PIP, Retention), Grievance & Query Handling, WFH Approvals",
  category: "HRBPs",
  outcome:
    "New joiners inducted and integrated. Separating employees counseled, retention attempted where warranted, exit formalities overseen. Employee queries resolved or routed. WFH requests approved/rejected. Behavioral/conduct issues addressed.",
  trigger:
    "Onboarding: Thamizh schedules weekly induction from joiner list. Offboarding: Darwinbox notification on resignation submission. Grievance: employee reaches out via Teams/email/in-person. WFH: employee raises in Darwinbox inbox or emails manager + HRBP. Manage-out: Talent Mobility team confirms redundancy list to Sanuj.",
  frequency:
    "Induction: weekly (Friday), 1 hour per session. Offboarding: per resignation (~54/month across org). Queries: 5-10 per HRBP per day. WFH approvals: 5-6 per day in Darwinbox task box. Retention: ~10/year (Rajitha), ~3-5/year (Thamizh). Manage-out: per org wave + ad hoc.",
  monthlyEffortProfile: [
    "Induction: ~1 hr/week per HRBP (rotational roster)",
    "Offboarding (voluntary): ~30 min per case (discussion + Darwinbox remarks)",
    "Retention: 2-3 weeks per case when active (multi-stakeholder coordination)",
    "Manage-out: varies by wave size (could be multiple cases in a week)",
    "Query handling: ~1-2 hrs/day per HRBP (5-10 queries)",
    "WFH approvals: ~15-30 min/day (5-6 approvals in Darwinbox)",
    "Grievance/conduct: ad hoc, can take days-weeks for complex cases",
  ],
  primarySpoc:
    "Thamizh Tharagai Pachaiyappan (Chennai location HRBP, induction SPOC) | Rajitha Shaganti (Hyderabad location HRBP) | Bangalore: Kunal, Pratibha, Nithya (not in this session)",
  systems: [
    "Darwinbox (separation workflow, remarks, WFH approvals in task box, NDA trigger monitoring)",
    "Teams (queries, 1:1 discussions, induction calls)",
    "Email (retention coordination, manage-out communication, grievance follow-up)",
    "PPT (induction deck — 45-50 slides)",
    "No dedicated HRBP tool or tracker for queries/grievances",
  ],
  steps,
  handoffs,
  interviewSource:
    "Session 1: Thamizh + Rajitha, May 15 2026 (50 min) — HRBP validation session covering onboarding, offboarding, grievance (interviewed by Sriharshini Rallabandi)",
  totalEstimatedSavings: "~30-50 hrs/mo per HRBP (~90-150 hrs/mo across team)",
  sourceFile: "desks/HRBP_Agent_Ready_Onboarding_Offboarding_GR.xlsx",
  status: "needs_follow_up",
};
