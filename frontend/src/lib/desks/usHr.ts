/** Real data, transcribed verbatim from desks/USHR_Agent_Ready.xlsx
 * (Session 1: Rashmi KN, 14 May 2026, full US HR walkthrough with live
 * screen share). Per the founder's 21 May 2026 email (desks/README.md),
 * this desk's documentation still needs post follow-up validation -- not
 * finalized like Onboarding/Offboarding. Rashmi KN is the same person who
 * runs the India Offer Desk (offerDesk.ts, 12 May 2026 sitting) -- two
 * real desks, one SPOC, deliberately not merged into one node (see
 * HrFunctionGraph.tsx). Everything below is copied from the sheet, not
 * paraphrased or estimated. */
import type { DeskHandoff, DeskSpec, DeskStep } from "./types";

const steps: DeskStep[] = [
  {
    id: "1",
    name: "Recruiter sends BGV request",
    whatHappens:
      "Recruiter sends BGV request via email with: candidate name, Job Vite ID, employment type (contractor/FT), client name, laptop shipment Y/N (+ shipping address if yes), tentative start date, reporting manager. For FT: offer letter attached (signed by candidate via client system). For contractors: no offer letter from Trianz (vendor handles).",
    system: "Email + Job Vite",
    timePerCase: "Recruiter action (triggers Rashmi)",
    volumePerMonth: "~10-12/mo",
    automationTag: "Fully automatable",
    spoc: "Recruiter",
  },
  {
    id: "2",
    name: "Update US Onboarding Tracker",
    whatHappens:
      "Rashmi updates US Onboarding Tracker (Excel in OneDrive) with candidate details: name, Job Vite ID, hire date, employment type, recruiter name, client, reporting manager. Jayanthi has access and uses DOJ field to schedule onboarding.",
    system: "Excel (OneDrive)",
    timePerCase: "3-5 min",
    volumePerMonth: "~10-12/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi KN",
  },
  {
    id: "3",
    name: "Initiate BGV",
    whatHappens:
      "Rashmi initiates BGV in Advanced Reporting tool: New Order → select entity → select client-specific check package → fill candidate first name, last name, email → send. Candidate auto-receives link to fill details and upload documents. Package selection by client: Liberty Mutual, IBM, NYL, Trianz Standard (lower grades), Trianz Executive Screening (Grade 8+).",
    system: "Advanced Reporting (BGV tool)",
    timePerCase: "5-10 min",
    volumePerMonth: "~10-12/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi KN",
  },
  {
    id: "4",
    name: "BGV execution and monitoring",
    whatHappens:
      "BGV execution: Advanced Reporting team performs checks. Statuses: Applicant Pending, Pending Reports, Completed, Yellow flags (approval required from Jayanthi). For Indian-origin employees with India education: international BGV is costly + slow (45 days) — Rashmi routes those checks to Sasikala (India BGV team) to save cost, telling Advanced Reporting to 'not perform India education, upload docs and close.'",
    system: "Advanced Reporting + Email",
    timePerCase: "Follow-up: 5 min/check; yellow flag: 10-15 min",
    volumePerMonth: "~10-12/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi KN (monitoring) / Advanced Reporting team (execution)",
  },
  {
    id: "5",
    name: "Email ID + laptop shipment request",
    whatHappens:
      "On BGV completion: Rashmi informs recruiter via email. Recruiter confirms email ID creation can proceed. Rashmi sends email ID creation request to IT team using standard template. If laptop shipment required: Rashmi drops mail to Sai Kumar with shipping address to ship laptop by DOJ.",
    system: "Email",
    timePerCase: "5 min",
    volumePerMonth: "~10-12/mo",
    automationTag: "Fully automatable",
    spoc: "Rashmi KN",
  },
  {
    id: "6",
    name: "Onboarding session",
    whatHappens:
      "Jayanthi conducts onboarding session on DOJ (she manages scheduling herself from the tracker). On completion, she emails Rashmi: 'Please go ahead, create the HRMS record.' She also instructs IT to enable access.",
    system: "Physical/Virtual (Jayanthi)",
    timePerCase: "Jayanthi owns (~30-60 min)",
    volumePerMonth: "~10-12/mo",
    automationTag: "Human-only",
    spoc: "Jayanthi",
  },
  {
    id: "7",
    name: "Create employee record (dual system)",
    whatHappens:
      "Rashmi creates employee record in BOTH Oracle Cloud (Hire an Associate / Add Contingent Worker) and Darwinbox (same fields as India onboarding process). Data sourced from Job Vite, CPR Rate Approval form, recruiter email, offer letter. Oracle Cloud will be phased out — Darwinbox becomes sole system.",
    system: "Oracle Cloud + Darwinbox",
    timePerCase: "20 min per candidate (dual system entry)",
    volumePerMonth: "~10-12/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi KN",
  },
  {
    id: "8",
    name: "Update tracker and file documents",
    whatHappens: "Rashmi updates tracker and uploads all documents (BGV reports, offer letter, etc.) to US Repository (OneDrive).",
    system: "Excel + OneDrive",
    timePerCase: "5 min",
    volumePerMonth: "~10-12/mo",
    automationTag: "Fully automatable",
    spoc: "Rashmi KN",
  },
  {
    id: "9",
    name: "Termination",
    whatHappens:
      "Rashmi receives termination request via email from a vendor (contract ending), delivery manager (project end), voluntary resignation, or Jayanthi (involuntary). Rashmi terminates record in BOTH Oracle Cloud (termination workflow) AND Darwinbox (Flows → Separation → Initiate Separation), same process as India separation. Jayanthi confirms IT disables employee ID and sends FNF to finance.",
    system: "Oracle Cloud + Darwinbox",
    timePerCase: "10-15 min (dual system)",
    volumePerMonth: "~5-8/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi KN",
  },
  {
    id: "10",
    name: "Experience / employment verification letters",
    whatHappens:
      "Jayanthi requests via email. Rashmi drafts letter in standard template: candidate name (from Oracle Fusion — verify correct), entity, start date, end date, role details. Jayanthi reviews and approves. Rashmi sends to candidate.",
    system: "Email + Oracle Cloud (for data)",
    timePerCase: "5 min per letter",
    volumePerMonth: "~3-5/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi KN (drafts) + Jayanthi (approves)",
  },
];

const handoffs: DeskHandoff[] = [
  {
    from: "US Recruiter",
    to: "Rashmi",
    whatIsPassed: "BGV request + candidate details + offer letter (FT)",
    format: "Email",
    trigger: "Post candidate selection",
  },
  {
    from: "Rashmi",
    to: "Advanced Reporting",
    whatIsPassed: "BGV initiation with client-specific package",
    format: "Advanced Reporting tool",
    trigger: "On request receipt",
  },
  {
    from: "Advanced Reporting",
    to: "Candidate",
    whatIsPassed: "BGV details submission link",
    format: "Auto-email from tool",
    trigger: "On BGV initiation",
  },
  {
    from: "Rashmi",
    to: "Sasikala (India BGV)",
    whatIsPassed: "India education check documents for Indian-origin employees",
    format: "Email",
    trigger: "When India education check needed",
  },
  {
    from: "Rashmi",
    to: "Jayanthi",
    whatIsPassed: "Yellow flag details for approval",
    format: "Email",
    trigger: "On BGV yellow flag",
  },
  {
    from: "Rashmi",
    to: "IT Team + Sai Kumar",
    whatIsPassed: "Email ID creation + laptop shipment request",
    format: "Email (standard template)",
    trigger: "Post BGV completion + recruiter go-ahead",
  },
  {
    from: "Jayanthi",
    to: "Rashmi",
    whatIsPassed: "Onboarding complete, create HRMS record",
    format: "Email",
    trigger: "Post DOJ onboarding session",
  },
  {
    from: "Rashmi",
    to: "Oracle Cloud + Darwinbox",
    whatIsPassed: "Employee record created (dual system)",
    format: "Oracle Cloud + Darwinbox UI",
    trigger: "On Jayanthi confirmation",
  },
  {
    from: "Jayanthi / Vendor / DM",
    to: "Rashmi",
    whatIsPassed: "Termination request",
    format: "Email",
    trigger: "On contract end / resignation / involuntary",
  },
  {
    from: "Jayanthi",
    to: "Rashmi",
    whatIsPassed: "Letter request (experience / employment verification)",
    format: "Email",
    trigger: "As needed",
  },
];

export const US_HR_SPEC: DeskSpec = {
  id: "us-hr",
  name: "US HR",
  workflowName: "US HR Support Services — BGV, Onboarding Record Creation, Email ID, Laptop Shipment, Termination, Letters",
  category: "US HR / HRSS",
  outcome:
    "US-based candidate: BGV completed (client-specific package), email ID created, laptop shipped, record created in Oracle Cloud + Darwinbox, onboarding completed by Jayanthi, termination processed, experience/employment verification letters issued",
  trigger:
    "Recruiter sends BGV request email with candidate details (name, Job Vite ID, employment type, client, laptop shipment Y/N, start date, reporting manager)",
  frequency: "2-3 candidates per week (significantly lower volume than India). Mix of contractors and full-time.",
  monthlyEffortProfile: [
    "Rashmi active time: ~4 hrs/day on US HR (shared with Offer Desk duties)",
    "Record creation: 20 mins per candidate (dual system: Oracle Cloud + Darwinbox)",
    "BGV initiation: 5-10 mins per candidate",
    "Experience/verification letters: 5 mins each",
    "BGV follow-up: varies (India verification checks via Sasikala can take 45 days)",
  ],
  primarySpoc: "Rashmi KN — sole person handling US HRSS",
  backup: "No formal backup. Nanditha knows the process. Jayanthi can self-serve in emergency.",
  systems: [
    "Advanced Reporting (BGV tool for US — client-specific packages)",
    "Job Vite (US recruitment tool — candidate details, first name, last name, email, phone, documents, CPR rate approval)",
    "Oracle Cloud (US HRIS — record creation for hire/contingent worker, termination)",
    "Darwinbox (parallel record creation — new, Oracle will be phased out)",
    "Email (all coordination: BGV requests, email ID creation, laptop shipment, onboarding confirmation, termination requests, letters)",
    "US Repository (OneDrive/SharePoint — document storage, BGV reports)",
  ],
  steps,
  handoffs,
  interviewSource: "Session 1: Rashmi KN, May 14 2026 (31 min) — full US HR walkthrough with live screen share (interviewed by Prachi Mundra + Rashmi KN)",
  totalEstimatedSavings: "~16 hrs/mo (~65% of US HR SPOC time)",
  sourceFile: "desks/USHR_Agent_Ready.xlsx",
  status: "needs_follow_up",
};
