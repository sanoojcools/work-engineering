/** Real data, transcribed verbatim from desks/Onboarding_Agent_Ready_Final.xlsx
 * (Session 1: Prerana Nayak, 6 May 2026, full process walkthrough; Session 2:
 * Prerana Nayak, 12 May 2026, time-motion + clarifications). Finalized per
 * the founder's 21 May 2026 email (desks/README.md). Nothing here is
 * invented -- every field, number, name, and policy is copied from that
 * sheet, not paraphrased or estimated. `spoc` on each step is the step's
 * own named actor (its "What happens" cell's grammatical subject) or, where
 * the step names no one else, the desk's own Primary SPOC. */
import type { DeskHandoff, DeskSpec, DeskStep } from "./types";

const steps: DeskStep[] = [
  {
    id: "1",
    name: "Recruiter initiates onboarding",
    whatHappens:
      "Recruiter initiates onboarding in Zwayam for candidate. Post‑integration, initiation flows directly into Darwinbox, and the recruiter initiates onboarding from there.",
    system: "Zwayam → Darwinbox (post-integration)",
    timePerCase: "Reshma/Recruiter owns (~5 mins)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Recruiter",
  },
  {
    id: "2",
    name: "Candidate fills pre-onboarding documents",
    whatHappens:
      "Candidate fills pre-onboarding documents in Zwayam/Darwinbox portal: Employment Application Form (EAF), education docs, employment docs (offer letters, experience letters, payslips), EPFO docs, ID proofs (PAN, Aadhaar, photograph), IEF (Interview Evaluation Form), MJS (Master Joining Sheet — multiple sheets: checklist, PF form), resume. 17-item checklist for pre-onboarding docs.",
    system: "Zwayam / Darwinbox (post-integration)",
    timePerCase: "15-20 mins (candidate action)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Candidate (self-service)",
  },
  {
    id: "3",
    name: "Offerdesk places docs in OneDrive (pre-integration)",
    whatHappens:
      "Offerdesk (Rashmi) downloads candidate docs from Zwayam, places in OneDrive folder (HR Ops → 2026 → [Month] → [Date]). POST-INTEGRATION: This step is ELIMINATED. Docs flow directly from Zwayam to Darwinbox.",
    system: "Zwayam → OneDrive (ELIMINATED post-integration)",
    timePerCase: "~10 mins (GOES TO ZERO post-integration)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Rashmi (Offer Desk)",
  },
  {
    id: "4",
    name: "Verify candidate documents",
    whatHappens:
      "Offerdesk verifies all candidate documents against uploaded proofs. Darwinbox has built-in validation (rejects wrong formats, invalid Aadhaar/phone). Common errors: Service line / cost center mapping mistakes (platforms → Concierto vs. Avrio), wrong contact numbers provided by candidate.",
    system: "Darwinbox / OneDrive",
    timePerCase: "10 mins per candidate",
    volumePerMonth: "~28-30/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi (Offer Desk)",
  },
  {
    id: "5",
    name: "Offer letter signed via Zoho",
    whatHappens:
      "Offer letter sent via Zoho: TA Head (Nagaraj) signs first, then sent to candidate for signature. Access restricted to Rashmi and Umesh. Notification to recruiters when TA Head signs.",
    system: "Zoho",
    timePerCase: "10 mins (includes compensation structure)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Rashmi (Offer Desk)",
  },
  {
    id: "6",
    name: "Onboarding acknowledgement + counter-sign",
    whatHappens:
      "Onboarding acknowledgement document: Previously sent via Zoho. NOW part of Darwinbox document collection — candidate signs digitally during pre-onboarding submission. Location-specific counter-sign still required.",
    system: "Darwinbox (moved from Zoho)",
    timePerCase: "Part of Step 2 (candidate side); counter-sign: 2 mins",
    volumePerMonth: "~28-30/mo",
    automationTag: "Partially automatable",
    spoc: "Candidate + location counter-signer (BLR→Prerana, HYD→Sasikala, CHN→Thamizh)",
  },
  {
    id: "7",
    name: "Welcome onboard mail",
    whatHappens:
      "Welcome onboard mail sent to candidate (personal email). CC: location SPOC + recruiters. Contains: reporting date, time (Slot 1: 10 AM or Slot 2: 4 PM), office address. CURRENT: Rashmi sends manually. POST-INTEGRATION: auto-triggered via Darwinbox 'Resend Welcome Mail' button (1 day prior to DOJ).",
    system: "Email (manual) → Darwinbox (post-integration)",
    timePerCase: "1 min (click) post-integration",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Rashmi (Offer Desk)",
  },
  {
    id: "8",
    name: "Mail ID creation request",
    whatHappens:
      "Mail ID creation request to IT team. Contains: candidate name, client group, reporting manager, grade. CURRENT: Manual email with tracker attachment. POST-INTEGRATION: auto-notification from Darwinbox onboarding workflow. Admin team also notified for onboarding kit.",
    system: "Email → Darwinbox (post-integration)",
    timePerCase: "Automated post-integration",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Rashmi (Offer Desk)",
  },
  {
    id: "9",
    name: "Virtual onboarding call invite",
    whatHappens:
      "Virtual onboarding call invite sent via Teams (1 day prior to DOJ). CANNOT be automated in Darwinbox — no call scheduling capability. Will remain manual.",
    system: "Microsoft Teams",
    timePerCase: "5 mins (batch if multiple joiners)",
    volumePerMonth: "~28-30/mo (~7/week, often batched)",
    automationTag: "Human-only",
    spoc: "Onboarding SPOC (Prerana/Sasikala/Thamizh)",
  },
  {
    id: "10",
    name: "Initiate onboarding in Darwinbox",
    whatHappens:
      "Rashmi/Recruiter initiates onboarding in Darwinbox: Employees → New Hire → Page 1 (first name, last name, personal email, DOB, DOJ, department, role, employment type FT/contractor, base location, grade, current location, reporting manager, HRHub per client group, contribution level/service line, cost center) → Page 2 (shift assignment, attendance policy, entity TDCPL, timesheet). Post-integration: Page 1 auto-populates from Zwayam. Page 2 (4 fields) requires manual selection based on employee type.",
    system: "Darwinbox",
    timePerCase: "5 mins (Page 1 auto-fills post-integration; Page 2 manual)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Partially automatable",
    spoc: "Rashmi / Recruiter",
  },
  {
    id: "11",
    name: "Candidate arrives at office",
    whatHappens:
      "Candidate arrives at office. Front desk/security: entry formalities (ID, sign-in). Front desk pings SPOC or manager via Teams. No-show: No cutoff difference between Slot 1 and Slot 2 — onboarding proceeds even if candidate comes late.",
    system: "Physical + Teams",
    timePerCase: "5 mins",
    volumePerMonth: "~28-30/mo",
    automationTag: "Human-only",
    spoc: "Front desk / Onboarding SPOC",
  },
  {
    id: "12",
    name: "SPOC meets candidate in person",
    whatHappens:
      "Onboarding SPOC meets candidate in person: introduction, orientation, collects remaining physical documents. TRANSITION: Post Onboarding 2.0, managers conduct day-of onboarding instead of HR Ops SPOC.",
    system: "Physical / In-person",
    timePerCase: "15 mins",
    volumePerMonth: "~28-30/mo",
    automationTag: "Human-only",
    spoc: "Onboarding SPOC (Prerana/Sasikala/Thamizh)",
  },
  {
    id: "13",
    name: "Appointment letter auto-triggers",
    whatHappens:
      "Appointment letter auto-triggers from Darwinbox to candidate's official email on DOJ. Auto-reminder if not signed. Offerdesk monitors.",
    system: "Darwinbox (auto)",
    timePerCase: "<1 min (system)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto) — Offerdesk monitors",
  },
  {
    id: "14",
    name: "Activate candidate record",
    whatHappens:
      "SPOC activates candidate record in Darwinbox: Onboarding tab → three dots → Activate. Generates Employee ID. All candidate-filled data flows into employee profile. IF candidate did not join: three dots → Cancel Onboarding.",
    system: "Darwinbox",
    timePerCase: "2-3 mins",
    volumePerMonth: "~28-30/mo",
    automationTag: "Partially automatable",
    spoc: "Onboarding SPOC (Prerana/Sasikala/Thamizh)",
  },
  {
    id: "15",
    name: "Auto-notifications to IT, Admin, Manager",
    whatHappens:
      "Auto-notifications trigger from Darwinbox to: (a) IT team — laptop + onboarding kit, (b) Admin — lunch, (c) Manager — assign buddy + seat.",
    system: "Darwinbox (auto)",
    timePerCase: "0 (system)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
  {
    id: "16",
    name: "Manager assigns buddy",
    whatHappens:
      "Manager assigns buddy in Darwinbox. Auto-mail to buddy: 'You have been assigned as buddy to [new joiner] joining tomorrow.' Assigned 1 day prior to DOJ.",
    system: "Darwinbox (auto)",
    timePerCase: "0 (system); Manager: 2 mins",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Manager",
  },
  {
    id: "17",
    name: "BGV initiated",
    whatHappens:
      "BGV initiated within 2 days of joining. SPOC selects vendor (3 vendors), sends documents + check requirements based on department/grade/client.",
    system: "Darwinbox + Email",
    timePerCase: "5-10 mins",
    volumePerMonth: "~28-30/mo",
    automationTag: "Partially automatable",
    spoc: "Onboarding SPOC (Prerana/Sasikala/Thamizh)",
  },
  {
    id: "18",
    name: "Weekly induction scheduling",
    whatHappens:
      "BU HR (Thamizh) schedules weekly Friday induction call (~1 hour). Thamizh assigns HRBP to conduct (e.g., Pratibha). HRBP sends Teams invite to new joiners (personal + official email).",
    system: "Microsoft Teams",
    timePerCase: "5 mins (scheduling only)",
    volumePerMonth: "~7/week batched",
    automationTag: "Partially automatable",
    spoc: "Thamizh (BU HR)",
  },
  {
    id: "19",
    name: "30-day feedback survey",
    whatHappens:
      "30-day feedback survey auto-triggers from Darwinbox. 5 dropdown questions (designed by Srichandana). SLA: 15 days. Auto-reminder if not filled.",
    system: "Darwinbox (auto)",
    timePerCase: "5-10 mins (employee action)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
  {
    id: "20",
    name: "90-day feedback survey",
    whatHappens: "90-day feedback survey auto-triggers. Same SLA (15 days), auto-reminder. Same 5 questions.",
    system: "Darwinbox (auto)",
    timePerCase: "5-10 mins (employee action)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
  {
    id: "21",
    name: "Payroll integration",
    whatHappens:
      "Payroll integration: Candidate bank details (filled during document submission) flow to payroll. Report generated via Darwinbox report scheduler. Umesh verifies details. Common issue: incomplete or incorrect bank details → Umesh emails associate for correction.",
    system: "Darwinbox",
    timePerCase: "10 mins (verification per batch)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Partially automatable",
    spoc: "Umesh (Payroll)",
  },
  {
    id: "22",
    name: "Assimilate & Act mail",
    whatHappens:
      "Assimilate & Act mail auto-triggers from Darwinbox to new joiners at scheduled time. Previously automated from Oracle; now automated from Darwinbox.",
    system: "Darwinbox (auto)",
    timePerCase: "0 (system)",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "Darwinbox (auto)",
  },
  {
    id: "23",
    name: "Mandatory compliance courses",
    whatHappens: "Mandatory compliance courses assigned by L&D team.",
    system: "LMS (L&D team)",
    timePerCase: "L&D team owns",
    volumePerMonth: "~28-30/mo",
    automationTag: "Fully automatable",
    spoc: "L&D team",
  },
];

const handoffs: DeskHandoff[] = [
  {
    from: "Recruiter",
    to: "Candidate",
    whatIsPassed: "Onboarding initiation + document collection links",
    format: "Zwayam portal → Darwinbox (post-integration)",
    trigger: "After offer acceptance",
  },
  {
    from: "Candidate",
    to: "Offerdesk (Rashmi)",
    whatIsPassed: "All pre-onboarding docs (17 items)",
    format: "Zwayam upload → Darwinbox (post-integration)",
    trigger: "Before DOJ",
  },
  {
    from: "Offerdesk",
    to: "Onboarding SPOC",
    whatIsPassed: "Welcome mail CC + joining notification",
    format: "Email → Darwinbox notification (post-integration)",
    trigger: "1 day prior to DOJ",
  },
  {
    from: "Offerdesk",
    to: "IT Team",
    whatIsPassed: "Mail ID creation request + candidate details",
    format: "Email with tracker → Darwinbox auto-notification (post-integration)",
    trigger: "1 day prior to DOJ (~7 PM)",
  },
  {
    from: "Front Desk",
    to: "Onboarding SPOC",
    whatIsPassed: "Candidate has arrived",
    format: "Teams message",
    trigger: "DOJ, on arrival",
  },
  {
    from: "SPOC",
    to: "Darwinbox",
    whatIsPassed: "Record activation → Employee ID generated",
    format: "Darwinbox UI (Activate button)",
    trigger: "DOJ, after meeting candidate",
  },
  {
    from: "Darwinbox",
    to: "Manager",
    whatIsPassed: "Assign buddy + seat allocation",
    format: "Auto-notification",
    trigger: "On activation",
  },
  {
    from: "SPOC",
    to: "BGV Vendor",
    whatIsPassed: "Candidate docs + check requirements",
    format: "Email + partial auto-flow from Darwinbox",
    trigger: "Within 2 days of DOJ",
  },
  {
    from: "Thamizh (BU HR)",
    to: "HRBP (e.g., Pratibha)",
    whatIsPassed: "Induction assignment + joiner list",
    format: "Email",
    trigger: "Weekly",
  },
  {
    from: "Darwinbox",
    to: "New Joiner",
    whatIsPassed: "30-day and 90-day feedback surveys",
    format: "Darwinbox auto-trigger",
    trigger: "30 and 90 days post-DOJ",
  },
  {
    from: "Darwinbox",
    to: "Umesh (Payroll)",
    whatIsPassed: "Payroll report with bank details",
    format: "Report scheduler",
    trigger: "Monthly payroll cycle",
  },
];

export const ONBOARDING_SPEC: DeskSpec = {
  id: "onboarding",
  name: "Onboarding",
  workflowName: "New Hire Onboarding (Permanent Associates & Contractors — same process)",
  category: "HR Ops — Onboarding",
  outcome:
    "New hire fully onboarded: record created and activated in Darwinbox, Employee ID generated, appointment letter signed, IT assets allocated, buddy assigned, BGV initiated, induction scheduled, 30 & 90-day feedback collected, payroll integrated",
  trigger:
    "Recruiter initiates onboarding in Zwayam after candidate accepts offer → post-integration: initiation flows directly into Darwinbox",
  frequency: "Per joiner. Two daily slots: Slot 1 (10:00 AM), Slot 2 (4:00 PM). ~7 joiners per week (~28-30 per month).",
  monthlyEffortProfile: [
    "SPOC (Prerana) active time: ~1 hr/day on onboarding days",
    "Breakdown: Document verification ~30%, Record creation/activation ~20%, Virtual call scheduling ~10%, Coordination/follow-up ~40%",
    "Post Zwayam-Darwinbox integration: expected to drop ~40% (manual download/upload eliminated)",
  ],
  primarySpoc: "Prerana Nayak (Bangalore) | Sasikala (Hyderabad) | Thamizh (Chennai)",
  backup: "Reshma (Prerana's backup for Bangalore). Process identical across all locations.",
  systems: [
    "Zwayam (recruitment → will integrate into Darwinbox)",
    "Darwinbox (HRIS: record creation, activation, onboarding workflow, auto-notifications, surveys, payroll reports)",
    "Zoho (offer letter signing — remains separate)",
    "Microsoft Teams (virtual onboarding call — manual, no Darwinbox configuration)",
    "OneDrive/SharePoint (document storage — will be eliminated post-integration)",
  ],
  steps,
  handoffs,
  interviewSource:
    "Session 1: Prerana Nayak, May 6 2026 (51 min) — full process walkthrough | Session 2: Prerana Nayak, May 12 2026 (20 min) — time-motion + clarifications (interviewed by Sriharshini and Prachi)",
  totalEstimatedSavings: "~22 hrs/mo (~55% of SPOC onboarding time) + new analytics capability",
  sourceFile: "desks/Onboarding_Agent_Ready_Final.xlsx",
  status: "finalized",
};
