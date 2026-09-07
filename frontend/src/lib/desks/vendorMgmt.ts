/** Real data, transcribed verbatim from desks/VendorMgmt_Agent_Ready.xlsx
 * (Session 1: Reshma V, 14 May 2026, full vendor management walkthrough).
 * Per the founder's 21 May 2026 email (desks/README.md), this desk's
 * documentation still "requires post follow-up documentation and
 * validation" -- not finalized like Onboarding/Offboarding. Every field,
 * number, name, and policy below is copied from that sheet, not
 * paraphrased or estimated. */
import type { DeskHandoff, DeskSpec, DeskStep } from "./types";

const steps: DeskStep[] = [
  {
    id: "1",
    name: "Invoice processing",
    whatHappens:
      "Vendors send invoices + timesheets to HRHub mailbox monthly (for previous month). Reshma validates each invoice: match invoice billing days against timesheet days in Darwinbox, match billing amount against PO rate, check vendor name/employee name/billing period, log in invoice tracker (vendor, location, employee ID, name, bill month, type, amount, PO number, invoice number, receipt raised date, submitted date, payment date). Submits validated invoices to finance team every Friday.",
    system: "Email + Excel (invoice tracker) + Darwinbox (timesheets)",
    timePerCase: "~5 hrs/day (across ~95-98 contractors)",
    volumePerMonth: "~95-98 invoices/mo (+ pre-selection, permanent charges)",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "2",
    name: "Timesheet follow-up (Ascent payroll)",
    whatHappens:
      "Ascent is a special vendor — Reshma manages timesheet submission for Ascent contractors. 16th-17th: reminder to submit timesheets in Darwinbox by 22nd + manager approval by 22nd + invoice by 22nd. 19th onwards: checks Darwinbox daily for submission status, pings non-submitters individually. Downloads timesheet report, shares with Ascent team to raise invoice. Cutoff: 23rd — invoices after cutoff deferred to next month.",
    system: "Email + Darwinbox (timesheet report)",
    timePerCase: "~3-5 hrs total (16th-23rd cycle)",
    volumePerMonth: "~30-40 Ascent contractors",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "3",
    name: "Direct consultant timesheet + invoice",
    whatHappens:
      "Same reminder cycle as Ascent but for direct consultants (sole proprietors). Consultants must submit timesheets AND raise their own invoices. Reshma sends monthly reminder, follows up, collects invoices, validates, submits to finance.",
    system: "Email + Darwinbox",
    timePerCase: "~1-2 hrs/mo",
    volumePerMonth: "~3 active consultants (currently very low)",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "4",
    name: "Consultant empanelment",
    whatHappens:
      "When a new consultant is hired (rare): recruiter sends request. Reshma coordinates with consultant to collect cancelled cheque, PAN card, CRF. Sends 3 agreements via Zoho for digital signature: Confidentiality Agreement, Consultant Agreement, DPA. On signing: shares all docs to finance team for vendor setup. Raises PR for consultant payments.",
    system: "Email + Zoho (digital signing)",
    timePerCase: "~30-45 min per consultant",
    volumePerMonth: "~1-2/year",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "5",
    name: "Vendor empanelment",
    whatHappens:
      "Same as consultant but for new vendor companies. Reshma coordinates agreements, gets them signed, shares to finance for vendor setup.",
    system: "Email + Zoho",
    timePerCase: "~30-45 min per vendor",
    volumePerMonth: "Rare",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "6",
    name: "Purchase requisition (PR)",
    whatHappens:
      "Reshma raises PRs in Oracle Procurement for: contract hires, permanent charges, contract extensions, pre-selection fees, training, rewards, other services. Approval chain: Rajesh (HR head) → Finance Manager → Senior Manager → Procurement team releases PO. PO sent directly to vendor from Oracle.",
    system: "Oracle Procurement",
    timePerCase: "15-30 min each",
    volumePerMonth: "~15-25/mo (extensions + new hires + pre-selection)",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "7",
    name: "Contract extension management",
    whatHappens:
      "Monthly, Reshma checks master tracker for contracts ending in the current month. Darwinbox auto-sends reminder to reporting manager 2 weeks before contract end. 3 options: convert to full-time, extend contract, or terminate. On extension: raise new PR. On termination: initiate exit. On conversion: hand to Offer Desk (Rashmi KN) for conversion process.",
    system: "Darwinbox (auto-reminders) + Excel (master tracker) + Oracle (PR)",
    timePerCase: "~2-3 hrs/mo total",
    volumePerMonth: "~5-10 contracts ending/mo",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "8",
    name: "Payment allocation",
    whatHappens:
      "Finance team shares payment details via Excel (all vendors in one batch). Reshma segregates by vendor using VLOOKUP/filter, sends individual payment notification to each vendor via email.",
    system: "Email + Excel",
    timePerCase: "5-10 min per batch",
    volumePerMonth: "~2-4 batches/mo",
    automationTag: "Fully automatable",
    spoc: "Reshma V",
  },
  {
    id: "9",
    name: "Vendor payment status queries",
    whatHappens:
      "Vendors call/email daily asking about payment status. Reshma checks payment terms (45/60 days), checks if overdue, responds. Significant delays common (some vendors have Jan payments still unpaid in May) — Reshma must manage vendor relationships and send apology mails for delays.",
    system: "Email + Excel (tracker)",
    timePerCase: "~30 min/day",
    volumePerMonth: "~20-30 queries/mo",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "10",
    name: "Pre-selection fee processing",
    whatHappens:
      "Recruiters use external panels for candidate interviews. Monthly, Reshma sends reminder to recruiters + vendors to confirm pre-selection counts. Recruiters and vendors each provide their own candidate list. Reshma cross-validates counts, raises PR, submits to finance.",
    system: "Email + Excel + Oracle (PR)",
    timePerCase: "~1-2 hrs/mo",
    volumePerMonth: "Varies",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "11",
    name: "Asset clearance",
    whatHappens:
      "When contractor contract ends, Reshma follows up on laptop return: checks if contractor will return to office or needs courier, initiates courier via admin team if remote, or asks contractor to submit in person. Tracked on laptop tracker.",
    system: "Excel (laptop tracker) + Email",
    timePerCase: "~15 min each",
    volumePerMonth: "~5-10/mo",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "12",
    name: "Annual vendor performance evaluation",
    whatHappens:
      "Annual (Aug/Sep): Reshma sends evaluation forms to recruiters for each active vendor they use. Recruiters rate vendor performance (quality, responsiveness, continuation recommendation). Reshma follows up for incomplete forms, compiles all evaluations, submits to finance team.",
    system: "Email + Excel (evaluation forms)",
    timePerCase: "~3-5 hrs total (annual, spread over 2-3 weeks)",
    volumePerMonth: "All active vendors",
    automationTag: "Partially automatable",
    spoc: "Reshma V",
  },
  {
    id: "13",
    name: "Ad hoc letters",
    whatHappens:
      "NOC, employment reference letter, internship letter, training letter. Reshma edits standard templates with employee details (dates, name, role), shares to employee CC HRBP. HCM changes (designation, reporting manager) are now handled in Darwinbox by BHRs directly — Reshma only assists if needed.",
    system: "Email + Word templates + Darwinbox",
    timePerCase: "~10 min each",
    volumePerMonth: "~2-3/mo",
    automationTag: "Fully automatable",
    spoc: "Reshma V",
  },
  {
    id: "14",
    name: "Consultant onboarding",
    whatHappens:
      "For new consultant joiners (very rare): Reshma ensures agreements signed 1 day prior. Sends welcome onboard mail + virtual link (if virtual). Takes onboarding call herself (even for other locations — virtual).",
    system: "Email + Teams + Zoho",
    timePerCase: "~30 min per consultant",
    volumePerMonth: "~1-2/year",
    automationTag: "Human-only",
    spoc: "Reshma V",
  },
];

const handoffs: DeskHandoff[] = [
  {
    from: "Vendors",
    to: "Reshma V",
    whatIsPassed: "Invoices + timesheets",
    format: "Email to HRHub mailbox",
    trigger: "Monthly (for previous month)",
  },
  {
    from: "Reshma V",
    to: "Finance team",
    whatIsPassed: "Validated invoices + raised receipts",
    format: "Email batch (every Friday) + Oracle Procurement receipts",
    trigger: "Weekly Friday",
  },
  {
    from: "Reshma V",
    to: "Ascent team",
    whatIsPassed: "Timesheet report for invoice raising",
    format: "Email with Darwinbox download",
    trigger: "Monthly (by 22nd)",
  },
  {
    from: "Reshma V",
    to: "Vendors",
    whatIsPassed: "Correction requests for mismatched invoices",
    format: "Email",
    trigger: "On mismatch detected",
  },
  {
    from: "Finance team",
    to: "Reshma V",
    whatIsPassed: "Payment allocation details (all vendors)",
    format: "Email with Excel",
    trigger: "Per payment release",
  },
  {
    from: "Reshma V",
    to: "Reporting managers",
    whatIsPassed: "Contract extension/termination confirmation request",
    format: "Darwinbox auto-reminder + manual email if needed",
    trigger: "2 weeks before contract end",
  },
  {
    from: "Reshma V",
    to: "Oracle Procurement",
    whatIsPassed: "Purchase requisitions",
    format: "Oracle Procurement UI",
    trigger: "Per event (hire, extension, pre-selection, etc.)",
  },
  {
    from: "Reshma V",
    to: "Rashmi KN (Offer Desk)",
    whatIsPassed: "Contractor conversion request",
    format: "Verbal/email handover",
    trigger: "On manager's conversion decision",
  },
  {
    from: "Reshma V",
    to: "Consultant",
    whatIsPassed: "Agreements (3 docs) via Zoho",
    format: "Zoho digital signing",
    trigger: "On new consultant hire",
  },
  {
    from: "Reshma V",
    to: "Finance team",
    whatIsPassed: "Consultant/vendor empanelment docs",
    format: "Email",
    trigger: "On agreements signed",
  },
];

export const VENDOR_MGMT_SPEC: DeskSpec = {
  id: "vendor-mgmt",
  name: "Vendor Mgmt",
  workflowName:
    "Vendor Management: Invoice Processing, Contract Extensions, Consultant Empanelment, Purchase Requisitions, Payment Allocation, Asset Clearance, Letters, Consultant Onboarding",
  category: "HR Ops — Vendor Management / Contractor Lifecycle",
  outcome:
    "Contractor invoices validated and submitted to finance, consultant/vendor empanelment completed, contracts extended/terminated, PRs raised and POs released, payments allocated to vendors, asset returns tracked, ad hoc letters issued",
  trigger:
    "Multiple triggers: vendor sends invoice (monthly), recruiter sends consultant/contractor hire request, contract end date approaching (auto-reminder from Darwinbox), payment allocation from finance, letter request from employee/HRBP, termination request",
  frequency:
    "Invoice processing: daily (bulk submission every Friday). Contract extensions: monthly check. Consultant empanelment: rare (1-2/year currently). PR raising: per event. Payment allocation: per finance release. Timesheet reminders: monthly 16th-17th.",
  monthlyEffortProfile: [
    "Reshma V active time: ~9 hrs/day total",
    "Invoice processing & validation: ~5 hrs/day (largest time sink — 95-98 active contractors)",
    "Timesheet follow-up (Ascent + direct consultants): monthly cycle 16th-23rd, ~3-5 hrs total",
    "Contract extension follow-ups: monthly, ~2-3 hrs",
    "PR raising: per event, ~15-30 min each",
    "Payment allocation: per finance release, 5-10 min per batch",
    "Vendor payment queries: daily, ~30 min",
    "Asset clearance: per contract end, ~15 min each",
    "Letters: rare, ~10 min each",
    "Consultant onboarding: very rare (1-2/year)",
  ],
  primarySpoc: "Reshma V — sole person handling all vendor management and contractor lifecycle",
  backup:
    "No formal backup. For terminations only: Sasikala can handle. For everything else: Reshma V must monitor even on leave (immediate terminations).",
  systems: [
    "Oracle Fusion / Darwinbox (timesheets submission, contract extension auto-reminders, record creation/termination)",
    "Oracle Procurement (purchase requisitions, PO release, receipts)",
    "Zoho (consultant agreement signing — digital signatures)",
    "Email / HRHub mailbox (invoices, requests, coordination)",
    "Excel trackers: (1) Invoice tracker, (2) Master tracker (contractor details), (3) Laptop tracker",
    "Darwinbox (timesheet validation, contract extension reminders — replacing Oracle Fusion)",
  ],
  steps,
  handoffs,
  interviewSource: "Session 1: Reshma V, May 14 2026 (41 min) — full vendor management walkthrough (interviewed by Prachi Mundra)",
  totalEstimatedSavings: "~140 hrs/mo (~75% of Vendor Mgmt time)",
  sourceFile: "desks/VendorMgmt_Agent_Ready.xlsx",
  status: "needs_follow_up",
};
