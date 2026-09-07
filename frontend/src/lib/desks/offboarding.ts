/** Real data, transcribed verbatim from desks/Offboarding_Agent_Ready_v2.xlsx
 * (Session 1: Sasikala Penigalapati, 7 May 2026, full process walkthrough;
 * Session 2: Sasikala Penigalapati, 12 May 2026, time-motion +
 * clarifications). Finalized per the founder's 21 May 2026 email
 * (desks/README.md). The sheet's own "Step #" column is blank for the
 * first row (the sheet starts counting at 2) -- numbered "1" here for a
 * stable id, matching how the sheet's own Automation Readiness Summary
 * already refers to it ("8 steps (1,2,4,7,19,20-trigger,25,26)"). Two
 * steps carry the sheet's own "Process Owner Comments" column verbatim,
 * appended in parentheses -- real corrections from the person who reviewed
 * the AI-drafted documentation, not this repo's commentary. */
import type { DeskHandoff, DeskSpec, DeskStep } from "./types";

const steps: DeskStep[] = [
  {
    id: "1",
    name: "Employee initiates separation",
    whatHappens:
      "Employee initiates separation in Darwinbox: Flows → Separation → Initiate Separation. Fields: Reason for resignation (dropdown), personal email, contact number, date of resignation (today only — no future/back dates), remarks (free text). System auto-calculates LWD based on notice period (60 or 90 days per offer letter). VOLUNTARY: employee initiates. INVOLUNTARY/TERMINATION: SPOC initiates as admin (BGV failure, absconding, misconduct). MANAGE-OUT: employee resigns after HRBP conversation, OR SPOC initiates as admin. (Process owner note: HR Hub is not configured in CC.)",
    system: "Darwinbox",
    timePerCase: "5 mins",
    volumePerMonth: "~54/mo",
    automationTag: "Fully automatable",
    spoc: "Employee (voluntary) / Sasikala (SPOC, admin cases)",
  },
  {
    id: "2",
    name: "Auto-notification to reporting manager",
    whatHappens:
      "Auto-notification to reporting manager: '[Employee] has resigned from services.' CC: HR Ops team + HRHub. Separate task created in manager's Darwinbox task box for supervisor discussion. (Process owner note: HR Hub is not configured in CC.)",
    system: "Darwinbox (auto)",
    timePerCase: "<1 min",
    volumePerMonth: "~54/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
  {
    id: "3",
    name: "Manager/Supervisor discussion",
    whatHappens:
      "Manager/Supervisor discussion with employee. Manager enters remarks in Darwinbox and approves. For MANAGE-OUT: HRBP (e.g., Pratibha) emails Separation SPOC (E-Separation ID) to close manager discussion as admin. SPOC navigates to employee record → Flows → Separation → Act → enters remarks ('manage out case') → approves. (Process owner note: BU HR will follow up for both normal resignations and Manage out cases.)",
    system: "Darwinbox + Email",
    timePerCase: "15-25 mins total (10-15 min discussion + 5-10 min submit)",
    volumePerMonth: "~54/mo",
    automationTag: "Partially automatable",
    spoc: "Reporting Manager",
  },
  {
    id: "4",
    name: "Auto-notification to HRBP",
    whatHappens:
      "Auto-notification to HRBP: supervisor discussion complete, HRBP's discussion pending. Task created in HRBP's Darwinbox task box.",
    system: "Darwinbox (auto)",
    timePerCase: "<1 min",
    volumePerMonth: "~54/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
  {
    id: "5",
    name: "HRHub (HRBP) discussion",
    whatHappens:
      "HRHub (HRBP) discussion with employee. HRBP enters remarks, approves in Darwinbox. Retention attempt: HRBP consults delivery team → checks with Talent Mobility/TA for replacement → if not possible, seeks CTC hike approval from delivery + Sanuj. NP waiver: HRBP emails Sanuj for approval → forwards approval to E-Separation ID + payroll.",
    system: "Darwinbox + Email",
    timePerCase: "5-10 mins to submit (discussion time varies: 15 min standard, 1-2 hrs for retention cases)",
    volumePerMonth: "~54/mo",
    automationTag: "Human-only",
    spoc: "HRBP",
  },
  {
    id: "6",
    name: "Separation details confirmed",
    whatHappens:
      "Separation details confirmed in Darwinbox: LWD (= notice period end, system uses for auto-deactivation), relieving date (= physical last working day, may differ for manage-out), final recovery days, separation type (Voluntary/Involuntary), separation reason (from master list), NP buyout (paid by employee / paid by employer for manage-out), remarks.",
    system: "Darwinbox",
    timePerCase: "5-10 mins",
    volumePerMonth: "~55/mo avg",
    automationTag: "Partially automatable",
    spoc: "Sasikala (Separation SPOC)",
  },
  {
    id: "7",
    name: "Clearance workflow auto-triggers",
    whatHappens:
      "Clearance workflow auto-triggers to ALL stakeholders 7 working days before LWD. Each stakeholder receives task in Darwinbox task box. Daily auto-reminders until closed. Stakeholders: PM, HOD, Accounts/Finance (Dilip), L&D (Ashik), HR Ops (Rajesh), HRHub, Assurance, Admin, IT Asset, IT Network, Payroll (Bramhananda), Performance Management.",
    system: "Darwinbox (auto)",
    timePerCase: "0 (system)",
    volumePerMonth: "~47 exits/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
  {
    id: "8",
    name: "PM clearance",
    whatHappens:
      "PM clearance: Manager provides inputs on timesheet approvals, leave approvals, pending assignments, expense approvals, mail forwarding (max 30 days, redirect to manager), department/client assets returned, KT/handover complete, client access removal, data backup (OneDrive/local drive/N/A), machine release to IT.",
    system: "Darwinbox",
    timePerCase: "5-10 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Manager (PM)",
  },
  {
    id: "9",
    name: "HOD clearance",
    whatHappens:
      "HOD clearance: Head of department confirms approval for relieving, manager recommendation, reportee documentation/feedback (if applicable), project changes done.",
    system: "Darwinbox",
    timePerCase: "5-10 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "HOD",
  },
  {
    id: "10",
    name: "Accounts/Finance clearance",
    whatHappens:
      "Accounts/Finance clearance (Dilip): checks recoveries — joining bonus (1-year service clause), default bonus, certification expenses (service period clause), other reimbursements with pending service periods. Reports recovery amount if applicable.",
    system: "Darwinbox + Finance",
    timePerCase: "5-10 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Dilip (Finance)",
  },
  {
    id: "11",
    name: "L&D clearance",
    whatHappens: "L&D clearance (Ashik): checks certification expense recovery (if applicable), e-learning / Trianz University access disabled.",
    system: "Darwinbox + LMS",
    timePerCase: "5 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Ashik (L&D)",
  },
  {
    id: "12",
    name: "HR Ops clearance",
    whatHappens:
      "HR Ops clearance (Rajesh): checks joining bonus recovery, default bonus recovery, commitment bonus recovery, H1B visa recovery (if applicable).",
    system: "Darwinbox",
    timePerCase: "5-10 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Rajesh (HR Ops)",
  },
  {
    id: "13",
    name: "Admin clearance",
    whatHappens:
      "Admin clearance confirms asset returns: stationary items, ID card (₹50 recovery if not returned), access card (₹750 recovery if not returned), Uber corporate access disabled, corporate SIM returned.",
    system: "Darwinbox",
    timePerCase: "5 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Admin team",
  },
  {
    id: "14",
    name: "IT Asset clearance",
    whatHappens: "IT Asset clearance confirms laptop received back.",
    system: "Darwinbox",
    timePerCase: "5 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "IT Asset team",
  },
  {
    id: "15",
    name: "IT Network clearance",
    whatHappens:
      "IT Network clearance confirms email deactivated on LWD, mail forwarding set up (per PM input, max 30 days to manager), data backup completed (per PM input). Depends on PM clearance inputs for mail forwarding and data backup decisions.",
    system: "Darwinbox + IT systems",
    timePerCase: "5-10 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "IT Network team",
  },
  {
    id: "16",
    name: "Payroll clearance",
    whatHappens: "Payroll clearance (Bramhananda) confirms joining bonus status, food coupon status, investment proof submission status.",
    system: "Darwinbox",
    timePerCase: "5 mins",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Bramhananda (Payroll)",
  },
  {
    id: "17",
    name: "Assurance clearance",
    whatHappens:
      "Assurance clearance confirms client portal/access revoked. Checks with delivery manager or designated SPOC. Only applicable if employee has client system access — if not, auto-cleared.",
    system: "Darwinbox",
    timePerCase: "5 mins",
    volumePerMonth: "~47/mo (subset)",
    automationTag: "Partially automatable",
    spoc: "Assurance team / delivery manager",
  },
  {
    id: "18",
    name: "Performance Management clearance",
    whatHappens:
      "Performance Management clearance for employees with reportees: feedback documentation captured, reviewer comments complete, team discussions done. Only if employee has direct reports.",
    system: "Darwinbox",
    timePerCase: "5-10 mins",
    volumePerMonth: "Subset of ~47/mo",
    automationTag: "Partially automatable",
    spoc: "Performance Management team",
  },
  {
    id: "19",
    name: "Exit interview",
    whatHappens:
      "Exit interview auto-triggered 2 days before LWD. Employee fills Darwinbox form: job satisfaction, work environment, growth, positives, areas for improvement, comparison with new role, would they rejoin, personal contact (optional). Not mandatory.",
    system: "Darwinbox (auto)",
    timePerCase: "5-7 mins (employee action)",
    volumePerMonth: "~47/mo",
    automationTag: "Fully automatable",
    spoc: "Employee (optional) — Darwinbox auto-trigger",
  },
  {
    id: "20",
    name: "NDA acknowledgement",
    whatHappens:
      "NDA acknowledgement: auto-email triggers 2 days before LWD with SharePoint link. Employee must acknowledge. BLOCKER: if NDA not acknowledged, relieving letter and experience letter will NOT be released.",
    system: "Darwinbox (trigger) + SharePoint",
    timePerCase: "2-10 mins (employee action)",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Employee — Darwinbox auto-trigger, SPOC follows up",
  },
  {
    id: "21",
    name: "SPOC reviews all clearances",
    whatHappens:
      "SPOC reviews all clearances before releasing relieving letter: (1) all 12 stakeholder clearances complete, (2) NDA acknowledged, (3) NP status, (4) all recoveries accounted for. Auto-release of letters INTENTIONALLY DISABLED to allow recovery verification. SPOC maintains personal Excel tracker for all active separations.",
    system: "Darwinbox + Email + Excel",
    timePerCase: "5-10 mins per employee (review + decision)",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Sasikala (Separation SPOC)",
  },
  {
    id: "22",
    name: "Relieving letter",
    whatHappens:
      "Relieving letter generated from Darwinbox: Admin Apps → HR Documents → Employee Separation → Relieving Letter → Generate → select company (TDCPL) → enter Employee ID → preview (verify dates) → send to personal email. CC: HRBP + Nanditha + Reshma.",
    system: "Darwinbox",
    timePerCase: "10 mins per letter",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Sasikala (Separation SPOC)",
  },
  {
    id: "23",
    name: "Experience letter",
    whatHappens:
      "Experience letter: two-step process. Step A: SPOC emails Rajesh with employee details (13 fields). Step B: Rajesh approves → SPOC generates letter in Darwinbox → sends to personal email. Released on the 12th of every month after Rajesh approval.",
    system: "Darwinbox + Email/Excel",
    timePerCase: "5 mins per letter (after approval received)",
    volumePerMonth: "~47/mo",
    automationTag: "Partially automatable",
    spoc: "Sasikala (Separation SPOC) + Rajesh approval",
  },
  {
    id: "24",
    name: "FNF input",
    whatHappens:
      "FNF (Full & Final Settlement) input: SPOC compiles consolidated list of all exits for the month. Two cycles: last working day of month, and 10th of next month. Each employee listed with FNF action (Release / Hold, with reason). Sent to Bramhananda (payroll).",
    system: "Email + Excel",
    timePerCase: "30-45 mins per batch",
    volumePerMonth: "~47 employees per batch",
    automationTag: "Partially automatable",
    spoc: "Sasikala (Separation SPOC)",
  },
  {
    id: "25",
    name: "Leavers report",
    whatHappens:
      "Leavers report: SPOC downloads from Darwinbox and sends to Talent Mobility team every Friday. Fields: Employee ID, employee name, associate type, DOJ, date of relieving/LWD, status.",
    system: "Darwinbox + Email",
    timePerCase: "5-10 mins",
    volumePerMonth: "All exits for the week",
    automationTag: "Fully automatable",
    spoc: "Sasikala (Separation SPOC)",
  },
  {
    id: "26",
    name: "Record auto-deactivation",
    whatHappens:
      "Record auto-deactivation: Darwinbox auto-deactivates employee record the day after LWD. Profile shows as inactive. Ex-employee retains access only to download relieving and experience letters.",
    system: "Darwinbox (auto)",
    timePerCase: "0 (system)",
    volumePerMonth: "~47/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
];

const handoffs: DeskHandoff[] = [
  {
    from: "Darwinbox",
    to: "Reporting Manager",
    whatIsPassed: "Resignation notification + supervisor discussion task",
    format: "Auto-email + Darwinbox task",
    trigger: "On resignation submission",
  },
  {
    from: "Darwinbox",
    to: "HRHub (HRBP)",
    whatIsPassed: "Supervisor discussion complete, HRHub discussion pending",
    format: "Auto-email + Darwinbox task",
    trigger: "After manager approves",
  },
  {
    from: "HRBP",
    to: "Separation SPOC",
    whatIsPassed: "NP waiver approval (Sanuj's email), manage-out confirmation, retention decision",
    format: "Email to E-Separation ID",
    trigger: "After HRBP discussion",
  },
  {
    from: "Darwinbox",
    to: "12 clearance stakeholders",
    whatIsPassed: "Clearance tasks with input forms",
    format: "Darwinbox task box + daily auto-reminders",
    trigger: "7 working days before LWD",
  },
  {
    from: "PM clearance",
    to: "IT Network",
    whatIsPassed: "Mail forwarding + data backup decisions",
    format: "Read from PM comments in Darwinbox",
    trigger: "After PM submits clearance",
  },
  {
    from: "SPOC",
    to: "Stakeholders (manual)",
    whatIsPassed: "Follow-up for pending clearances",
    format: "Manual email (no template, drafted each time)",
    trigger: "Day 1 after LWD if pending",
  },
  {
    from: "SPOC",
    to: "Rajesh",
    whatIsPassed: "Experience letter approval request",
    format: "Email with employee details (13 fields)",
    trigger: "After relieving letter released",
  },
  {
    from: "Rajesh",
    to: "SPOC",
    whatIsPassed: "Experience letter approval",
    format: "Email",
    trigger: "1-2 days after request",
  },
  {
    from: "SPOC",
    to: "Bramhananda (Payroll)",
    whatIsPassed: "FNF input: exit list with release/hold",
    format: "Manual email with list",
    trigger: "Month-end + 10th",
  },
  {
    from: "SPOC",
    to: "Umesh (Payroll)",
    whatIsPassed: "Recovery details, waiver emails",
    format: "Manual email",
    trigger: "Ongoing",
  },
  {
    from: "SPOC",
    to: "Talent Mobility",
    whatIsPassed: "Leavers report",
    format: "Email with Darwinbox download",
    trigger: "Every Friday",
  },
];

export const OFFBOARDING_SPEC: DeskSpec = {
  id: "offboarding",
  name: "Offboarding",
  workflowName: "Employee Separation (Voluntary, Involuntary, Manage-Out, Termination)",
  category: "HR Ops — Offboarding / Exit",
  outcome:
    "Employee record terminated in Darwinbox, all clearances completed across 12 stakeholder types, recoveries settled (joining bonus, default bonus, commitment bonus, H1B visa, certification expenses, asset recovery), NDA acknowledged, relieving letter issued, experience letter issued (post Rajesh approval), FNF processed, record auto-deactivated",
  trigger:
    "VOLUNTARY: Employee initiates via Darwinbox → Flows → Separation → Initiate Separation | INVOLUNTARY/TERMINATION: HR Ops SPOC (Sasikala) initiates as admin in Darwinbox | MANAGE-OUT: BO/Talent Mobility identifies redundancy → HRBP communicates → employee resigns (voluntary path) or SPOC initiates (admin path)",
  frequency:
    "Daily processing. ~54 permanent associate separations/month (April 2026 actual). ~47 exits reaching clearance/letter stage per month. ~2-3 new resignations per week.",
  monthlyEffortProfile: [
    "SPOC active time: ~3 hrs/day (~60 hrs/month)",
    "Breakdown: Clearance follow-ups ~40%, Letter generation ~20%, FNF/payroll inputs ~15%, Email/admin ~25%",
    "FNF compilation: 30-45 mins/month (2 batches)",
    "Exception handling: 5-6 cases/month (max 10)",
  ],
  primarySpoc: "Sasikala Penigalapati — SOLE full admin access to separation process",
  backup:
    "Reshma — knows day-of tasks (record termination, email disabling, letter release) but NOT FNF. No formal KT plan exists. Rajesh has not initiated cross-training. (Process owner note on the sitting's own exception catalog: full Darwinbox access has since been identified for Reshma.)",
  systems: [
    "Darwinbox (separation initiation, approval workflows, clearance tasks, letter generation, record deactivation, auto-notifications, auto-reminders)",
    "SharePoint (NDA acknowledgement link)",
    "Email (manual follow-ups, waiver approvals, payroll inputs, leavers report)",
    "Excel (SPOC personal tracking sheet for active separations)",
  ],
  steps,
  handoffs,
  interviewSource:
    "Session 1: Sasikala Penigalapati, May 7 2026 (54 min) — full process walkthrough | Session 2: Sasikala Penigalapati, May 12 2026 (25 min) — time-motion + clarifications (interviewed by Prachi Mundra)",
  totalEstimatedSavings: "~42 hrs/mo (~70% of SPOC time)",
  sourceFile: "desks/Offboarding_Agent_Ready_v2.xlsx",
  status: "finalized",
};
