// Real data, transcribed verbatim from the uploaded interview-sourced
// workflow document (OfferDesk_Agent_Ready.xlsx -- Session 1: Rashmi KN,
// May 12 2026, full process walkthrough with live screen share). Nothing
// here is invented: every field, number, name, and policy is copied from
// that source, not paraphrased or estimated. Used to give the Function
// Scope -> HR sub-function drill-down a real, fully transparent worked
// example instead of a generic placeholder.

export const OFFER_DESK_META = {
  workflowName: "Offer Desk — Pre-Onboarding Processing (Offer Release, Document Verification, Payroll Inputs)",
  category: "HR Ops — Offer Desk / Pre-Onboarding",
  outcome: "Candidate verified, offer letter released and signed, all pre-onboarding documents collected and placed, email ID created, welcome mail sent, onboarding acknowledgement signed, PR sheet updated (contractors), candidate handed over to Onboarding SPOC (as per location)",
  trigger: "Recruiter sends offer request email with salary approval attachment + candidate profile in Zwayam",
  frequency: "Daily. SLA: 2 hours from recruiter request to offer letter release. Contractors: 6-7/day avg (max 10-12). Permanent: 4-5/day avg. Interns/Campus: occasional.",
  monthlyEffortProfile: ["Rashmi active time: ~5 hrs/day", "Breakdown: Document verification ~40% (most time-intensive), Master tracker updates ~20%, Offer letter processing ~15%, Email ID creation/welcome mails ~10%, Payroll reports (17th) ~10%, PR sheet/misc ~5%", "Permanent candidates take 30-40 mins each (employment verification heavy). Contractors take 15-20 mins each."],
  primarySpoc: "Rashmi (Offer Desk) — handles ALL hire types across BLR, HYD, CHN",
  backup: "Umesh (was previous Offer Desk owner, now payroll). Takes over when Rashmi is on leave.",
  hireTypes: "Permanent (lateral + campus/fresher), Contractor (Asset payroll = BGV required; non-Asset = vendor handles), Intern (duration-based, separate letter template), Conversion (contractor → FT: additional docs + HR round)",
  systems: ["Zwayam (candidate profiles, fitment, document repository, offer letter trigger via Zoho)", "Zoho (offer letter signing: TA Head → Candidate, onboarding acknowledgement signing, HR Head → Appointment Letter signing)", "OneDrive (HR Ops repository: document folders by year/month/date)", "Excel (Master Joining Sheet, PR sheet for contractors, email ID creation tracker, salary grid, payroll reports)", "Email (recruiter communication, IT team, travel team, payroll inputs)"],
  keyPolicies: ["Salary grid: GTS and Platforms have different scales per grade. Deviation >0% requires Vasu + Nagaraj approval (triggered in Zwayam).", "Variable pay: 8% for Grade 5+ in GTS/Core functions. Platforms: NO variable pay at any level.", "Joining bonus: amounts >1L split into 2 installments (4th and 8th month). ~40-50% of candidates receive joining bonus.", "Default/Deferred bonus: folded into CTC, vests after 1 year on DOJ anniversary.", "Designation-grade mapping: strict — must match approved list. Core functions vs Technical have different designation sets.", "IEF: mandatory screenshots for virtual interviews. Cross-check candidate identity against passport photo.", "UAN service history: mandatory. Gaps or dual employment = offer not released without deviation approval.", "Email ID: max 18 characters. Offerdesk creates name, IT configures.", "Offer acceptance: max 4 days for future-dated joiners. Immediate joiners sign on DOJ.", "Fresher: Grade A. Contractor/Intern: Grade C. No UAN/employment history required for freshers."],
  keyIntegrations: ["Zwayam API: candidate profile, document repository, fitment data, offer letter trigger", "Zoho API: offer letter signing status, onboarding acknowledgement signing", "OneDrive API: document folder creation and placement", "Excel/structured data: Master Joining Sheet, PR sheet, salary grid, payroll input templates", "Email: recruiter requests, IT email ID creation, travel team relocation, payroll reports (17th)"],
  transitionState: ["EF + MJS: being automated in Zwayam (candidate fills digitally, auto-generates PDF). Expected within 1 week.", "Offer letter: ALREADY automated (Zwayam → Zoho trigger). Previously manual.", "Contractor offer letter: still manual, automation in progress.", "Onboarding acknowledgement: being moved to Zwayam → Zoho auto-trigger (same as offer letter)."],
  interviewSource: "Session 1: Rashmi KN, May 12 2026 (1 hr 47 min) — full process walkthrough with live screen share (interviewed by Rashmi KN + Prachi Mundra+Sriharshini Rallabandi)",
};

export type OfferDeskStep = {
  step: number;
  whatHappens: string;
  decisionBranches: string[];
  system: string;
  stepType: string;
  dataFieldsRaw: string;
  docsPolicies: string[];
  automationTag: string;
  timePerCase: string;
  frequency: string;
  volumePerMonth: string;
  waitCycleTime: string;
  agentNotes: string;
};

export const OFFER_DESK_STEPS: OfferDeskStep[] = [
  {
    step: 1,
    whatHappens: "Recruiter sends offer request via email. Contains: Application ID, candidate name, hiring manager, in-person/virtual flag, contract approval (contractors), DOJ, salary approval mail attachment. Documents should be uploaded in Zwayam.",
    decisionBranches: [],
    system: "Email + Zwayam",
    stepType: "System-executed",
    dataFieldsRaw: "READ: Application ID, candidate name, manager, DOJ, salary approval\nLINK: Zwayam candidate profile",
    docsPolicies: ["Salary approval mail"],
    automationTag: "Fully automatable",
    timePerCase: "Recruiter action (triggers Rashmi)",
    frequency: "Daily",
    volumePerMonth: "Contractors: 6-7/day Permanent: 4-5/day",
    waitCycleTime: "None",
    agentNotes: "AGENT: Monitor Offer Desk inbox for new requests. Parse email for Application ID, DOJ, hire type. Auto-pull candidate profile from Zwayam API. Create task for Rashmi with structured data.",
  },
  {
    step: 2,
    whatHappens: "Rashmi pulls candidate profile from Zwayam. Checks all documents uploaded. If missing: emails recruiter to get candidate to upload.\nDocuments required vary by hire type:\nPERMANENT: EF (signed), MJS, education (10th + graduation mandatory), employment (all service letters + UAN service history), EPFO (from 2016), current company (offer letter + 3 months payslip + LWD confirmation), ID (Aadhaar + PAN + passport photo), IEF (interview screenshots for virtual rounds), resume\nCONTRACTOR: EF (only if Asset payroll for BGV), MJS (contractor version — limited fields), deputation letter, ID (Aadhaar + PAN + photo), IEF\nFRESHER: Same as permanent minus employment/UAN (not applicable). Grade A.\nINTERN: Minimal docs. Separate letter template.",
    decisionBranches: ["IF docs complete: proceed", "IF docs missing: email recruiter → recruiter follows up with candidate", "IF UAN service history missing/inactive: trigger UAN generation guide to candidate", "IF employment gap in UAN: check with candidate, may need bank statement or BGV", "IF dual employment detected in UAN: do NOT release offer (deviation approval required)"],
    system: "Zwayam + OneDrive",
    stepType: "Manual (judgment)",
    dataFieldsRaw: "READ: All uploaded docs in Zwayam\nVERIFY: Education certs (name + dates), employment service letters (start/end dates vs UAN vs resume), pay slips (UAN number present), IEF screenshots (candidate identity match), EF (signature present)\nWRITE: Verification status, missing doc notifications",
    docsPolicies: ["17-item onboarding checklist", "UAN service history requirements", "IEF identity verification protocol"],
    automationTag: "Partially automatable",
    timePerCase: "Contractors: 15-20 min Permanent: 30-40 min (employment verification is heaviest)",
    frequency: "Per candidate",
    volumePerMonth: "~200-250/mo total (all types)",
    waitCycleTime: "None — SLA 2 hrs from request",
    agentNotes: "AGENT: HIGH-VALUE TARGET #1. Can auto-check: (1) document completeness against hire-type checklist, (2) EF signature present (image detection), (3) UAN service history dates vs resume dates vs service letter dates (cross-validation), (4) IEF screenshot face match against passport photo, (5) pay slip UAN number present. HUMAN NEEDED: judgment on employment gaps, dual employment decisions, non-standard documents. Auto-flag missing docs to recruiter immediately.",
  },
  {
    step: 3,
    whatHappens: "Rashmi verifies salary approval mail: checks CTC, variable pay, joining bonus, deferred bonus, ESOP, NP buyout, relocation, referral source, grade, designation.\nCross-checks against salary grid (GTS vs Platforms scales per grade). Calculates deviation %.\nIF deviation >0%: Zwayam triggers 2-level approval (Vasu + Nagaraj).\nIF Platforms: NO variable pay at any level. IF GTS/Core Grade 5+: 8% variable pay mandatory.",
    decisionBranches: ["IF within grid: proceed", "IF deviation: 2-level approval required (auto-triggered in Zwayam)", "IF Platforms + variable pay listed: flag error to recruiter", "IF GTS Grade 5+ + no variable pay: flag to recruiter", "IF employee referral + referral name missing: cannot process", "IF vendor source + vendor name missing: cannot process"],
    system: "Excel (salary grid) + Zwayam + Email",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "READ: CTC, variable pay %, grade, designation, source type, referral name, joining bonus amount, deferred bonus, ESOP, NP buyout, relocation approval\nCALCULATE: Deviation % against grade min/max\nVERIFY: Designation matches grade (core functions vs technical list)",
    docsPolicies: ["Salary grid (GTS + Platforms)", "Designation-grade mapping", "Variable pay rules", "Deviation approval policy"],
    automationTag: "Partially automatable",
    timePerCase: "5-10 min",
    frequency: "Per candidate",
    volumePerMonth: "~200-250/mo",
    waitCycleTime: "Deviation approval: typically same day",
    agentNotes: "AGENT: HIGH-VALUE TARGET #2. Can fully automate: (1) deviation calculation against salary grid, (2) variable pay rule check (Platforms = 0, GTS G5+ = 8%), (3) designation-grade mapping validation, (4) source type completeness (referral name, vendor name). Flag violations before human review. Only edge cases need Rashmi.",
  },
  {
    step: 4,
    whatHappens: "Rashmi updates Master Joining Sheet (OneDrive Excel) with all candidate details: TR number, org group, account, grade, designation, DOJ, location, personal email, hire type, source, reporting manager, recruiter, relocation, accommodation, joining bonus (4th + 8th month split), deferred bonus, NP buyout, ESOP, variable pay.\nFor CONTRACTORS additionally: updates PR sheet (purchase order tracking) with offer date, candidate name, Employee ID, skills, contract start/end dates, amount. Reshma uses PR sheet for Oracle Fusion PO creation.",
    decisionBranches: ["IF contractor: update PR sheet additionally", "IF joining bonus >1L: split into 4th and 8th month installments", "IF joining bonus ≤1L: single installment at 4th month", "IF manager-approved exception: 1st month (rare, 1-2%)"],
    system: "Excel (OneDrive)",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "WRITE: All fields in Master Joining Sheet (~30 columns)\nWRITE (contractors): PR sheet fields (offer date, name, EmpID, skills, contract dates, amount)\nREAD: Zwayam profile, salary approval mail, recruiter request email",
    docsPolicies: ["Master Joining Sheet template", "PR sheet template"],
    automationTag: "Partially automatable",
    timePerCase: "5-10 min per candidate (batch at end of day)",
    frequency: "Per candidate",
    volumePerMonth: "~200-250/mo",
    waitCycleTime: "None",
    agentNotes: "AGENT: Can auto-populate ~80% of Master Joining Sheet fields from Zwayam API + salary approval parsing. Joining bonus split logic is deterministic (>1L = 4th+8th; ≤1L = 4th only). PR sheet auto-fill from same data. HUMAN: verify final values, edge cases.",
  },
  {
    step: 5,
    whatHappens: "Rashmi triggers offer letter in Zwayam. Zwayam pushes to Zoho for signing. Signing chain: TA Head (Nagaraj) signs first → then sent to candidate.\nFor CONTRACTORS with Asset payroll: separate email to Asset vendor to release their offer letter.\nFor CAMPUS: 2 additional annexures added (campus snapshot + early learning program).\nFor candidates with joining bonus / deferred bonus / NP buyout / ESOP: respective clauses auto-added to offer letter in Zwayam template.\nDeferred bonus: date = DOJ but next year (must be manually entered correctly).\nOffer acceptance window: immediate joiners = DOJ. Future joiners = max 4 days.",
    decisionBranches: ["IF permanent/campus: trigger in Zwayam → Zoho", "IF contractor (Asset): email Asset vendor to release", "IF contractor (non-Asset): contractor-specific Zwayam trigger (being automated)", "IF intern: manual letter generation (standard template)", "IF campus: add 2 annexures", "IF deferred bonus: manually enter vest date (DOJ + 1 year)", "IF ESOP: add ESOP clause (Grade 7+ / leadership only)"],
    system: "Zwayam → Zoho",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "WRITE: Offer letter generated with all applicable clauses\nTRIGGER: Zoho signing workflow (TA Head → Candidate)\nREAD: All salary details, bonus details, ESOP, clauses",
    docsPolicies: ["Offer letter templates (permanent, contractor, intern, campus)", "Annexures (5 standard + 2 campus)", "Bonus/ESOP clause templates"],
    automationTag: "Partially automatable",
    timePerCase: "5-10 min (mostly automated now)",
    frequency: "Per candidate",
    volumePerMonth: "~200-250/mo",
    waitCycleTime: "TA Head signs same day typically Candidate: 1-4 days",
    agentNotes: "AGENT: Offer letter generation already automated for permanent. Agent can: (1) auto-verify all clauses are correct before trigger, (2) monitor Zoho signing status, (3) auto-remind candidate if not signed within 2 days, (4) auto-confirm to Rashmi when signed. For contractors/interns: manual templates being automated. Deferred bonus date entry is error-prone — agent can auto-calculate.",
  },
  {
    step: 6,
    whatHappens: "Once offer signed: Rashmi sends Onboarding Acknowledgement via Zoho for candidate signature. Location-specific SPOC counter-signs.\nBeing automated: will trigger from Zwayam → Zoho same as offer letter.",
    decisionBranches: ["Counter-signer by location:", "BLR → Prerana", "HYD → Sasikala", "CHN → Tamil"],
    system: "Zoho → Zwayam (being automated)",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "WRITE: Acknowledgement document sent, signature status\nREAD: Candidate location, SPOC mapping",
    docsPolicies: ["Onboarding acknowledgement template", "NDA, PF form, company policies"],
    automationTag: "Fully automatable",
    timePerCase: "2-3 min (will be automated)",
    frequency: "Per candidate",
    volumePerMonth: "~200-250/mo",
    waitCycleTime: "Candidate signs same day typically",
    agentNotes: "AGENT: Being moved to Zwayam → Zoho auto-trigger. Agent monitors signing status. Counter-signer routing is simple location rule.",
  },
  {
    step: 7,
    whatHappens: "Rashmi sends Welcome Onboard mail to candidate (personal email). CC: location Onboarding SPOC + recruiter. Contains: reporting date, time (Slot 1: 10 AM or Slot 2: 4 PM), office address, virtual call link (if virtual).\nSent individually per candidate (no mail merge). Sent in evening (~7 PM) after all day’s requests are processed.",
    decisionBranches: ["IF in-person: standard welcome template with office address", "IF virtual: add virtual call link (10:30 AM fixed timing)", "IF Slot 2: ensure time shows 4 PM (important for half-day salary processing)"],
    system: "Email (manual)",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "WRITE: Welcome email sent\nREAD: Candidate name, DOJ, slot, location, SPOC, virtual/in-person flag",
    docsPolicies: ["Welcome mail template"],
    automationTag: "Fully automatable",
    timePerCase: "2-3 min per candidate",
    frequency: "Per candidate (batched in evening)",
    volumePerMonth: "~200-250/mo",
    waitCycleTime: "Sent evening before DOJ",
    agentNotes: "AGENT: Post Darwinbox integration: auto-triggered. Pre-integration: agent can auto-generate email from template with all fields populated. Rashmi just reviews and clicks send. Slot 2 flag important for payroll (half-day).",
  },
  {
    step: 8,
    whatHappens: "Rashmi sends Email ID creation request to IT team. Excel tracker with: full name, first name, last name, organization/platform, DOJ, location, designation, grade, personal email, hire type, account, cost center, service line, reporting manager, recruiter, in-person/virtual, slot.\nEmail ID must be ≤18 characters. Offerdesk creates the name; IT configures.\nIT responds with created email ID + user ID. Response goes to all (including reporting manager, Onboarding SPOC).",
    decisionBranches: ["IF name >18 chars: Rashmi must shorten/abbreviate", "IF account/domain not specified by recruiter: Rashmi must check before sending"],
    system: "Email + Excel",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "WRITE: Email ID creation tracker (18 fields)\nREAD: All candidate details from Master Joining Sheet\nRESPONSE: IT sends back email ID + user ID",
    docsPolicies: ["Email ID creation tracker template"],
    automationTag: "Fully automatable",
    timePerCase: "5 min total (batched for all candidates in evening)",
    frequency: "Daily batch",
    volumePerMonth: "~200-250/mo",
    waitCycleTime: "IT creates by next morning (~overnight)",
    agentNotes: "AGENT: Post Darwinbox integration: auto-notified. Pre-integration: agent can auto-populate tracker from Master Joining Sheet. Auto-check name ≤18 chars. Auto-send to IT. Flag if IT hasn’t responded by DOJ morning.",
  },
  {
    step: 9,
    whatHappens: "Rashmi places all verified documents in OneDrive folder: HR Ops repository → [Year] → [Month] → [Date]. Creates folder for each DOJ date. Renames offer letter PDF with candidate name.\nNotifies Onboarding team via group chat: candidate name, location, documents placed, mode (in-person/virtual), onboarding mail sent, tracker updated, acknowledgement sent, SPOC assignment.",
    decisionBranches: [],
    system: "OneDrive + Teams group chat",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "WRITE: Documents placed in folder\nWRITE: Group chat notification with all details",
    docsPolicies: ["Folder structure: HR Ops → Year → Month → Date"],
    automationTag: "Fully automatable",
    timePerCase: "3-5 min per candidate",
    frequency: "Per candidate",
    volumePerMonth: "~200-250/mo",
    waitCycleTime: "Done after all other steps",
    agentNotes: "AGENT: Post Darwinbox integration: documents flow directly, no folder placement needed. Pre-integration: agent can auto-create date folders, auto-place docs, auto-send group chat notification with structured template. Eliminates manual file management.",
  },
  {
    step: 10,
    whatHappens: "Every 17th of month: Rashmi sends payroll reports to Umesh.\nReport 1: Joining bonus — all candidates with joining bonus, 4th and 8th month schedule, amounts.\nReport 2: Deferred bonus — candidates whose deferred bonus vests that month (DOJ anniversary).\nReport 3: Referral bonus — employee referrals with referral name, candidate grade, amount per grade. Cross-check: referrer must NOT be on interview panel (IEF check). Rajesh approves before sending to payroll.",
    decisionBranches: ["JOINING BONUS: IF >1L → 4th + 8th month split. IF ≤1L → 4th month only.", "DEFERRED BONUS: vest date = DOJ + 1 year. Check monthly.", "REFERRAL BONUS: amount varies by candidate grade. Referrer must not be on IEF panel. IF referrer on panel → not eligible."],
    system: "Excel + Email",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "READ: Master Joining Sheet (joining bonus, deferred bonus, referral details)\nWRITE: 3 payroll report templates\nSEND: To Umesh (joining + deferred) and Rajesh (referral for approval)",
    docsPolicies: ["Joining bonus policy (installment rules)", "Deferred bonus policy (1-year vest)", "Referral bonus policy (grade-based amounts, panel exclusion rule)"],
    automationTag: "Partially automatable",
    timePerCase: "30-45 min total (3 reports compiled)",
    frequency: "Monthly (17th)",
    volumePerMonth: "All applicable candidates for the month",
    waitCycleTime: "Rajesh approval for referral: 1-2 days",
    agentNotes: "AGENT: HIGH-VALUE TARGET #3. All three reports can be auto-generated from Master Joining Sheet data: (1) filter joining bonus cases, auto-calculate 4th/8th month, (2) filter deferred bonus by DOJ anniversary, (3) filter referrals, cross-check IEF panel membership, calculate grade-based amount. Agent sends to Umesh/Rajesh on schedule. Eliminates 30-45 min manual compilation.",
  },
  {
    step: 11,
    whatHappens: "Candidate drops out before joining: Rashmi checks with recruiter 2 days before DOJ for future-dated joiners. If candidate confirmed not joining: updates Master Joining Sheet with reason (retained by current company, better opportunity, personal reasons). Recruiter handles candidate communication.",
    decisionBranches: ["IF candidate drops: update status + reason in tracker", "IF candidate confirmed joining: proceed with welcome mail + email ID creation"],
    system: "Email + Excel",
    stepType: "Manual (rule-based)",
    dataFieldsRaw: "WRITE: Dropout status, reason, date\nREAD: Recruiter confirmation",
    docsPolicies: [],
    automationTag: "Partially automatable",
    timePerCase: "5 min",
    frequency: "Per dropout case",
    volumePerMonth: "~10-15% of offers",
    waitCycleTime: "2 days before DOJ: confirmation check",
    agentNotes: "AGENT: Auto-check with recruiter 2 days before DOJ for all future-dated joiners. Parse response. Auto-update tracker on dropout. Auto-cancel downstream processes (welcome mail, email ID creation, folder creation).",
  },
];

export type OfferDeskHandoff = {
  from: string; to: string; whatIsPassed: string; format: string; trigger: string; agentPotential: string;
};

export const OFFER_DESK_HANDOFFS: OfferDeskHandoff[] = [
  { from: "Recruiter", to: "Rashmi (Offer Desk)", whatIsPassed: "Offer request with salary approval, candidate profile in Zwayam", format: "Email + Zwayam", trigger: "On fitment approval", agentPotential: "Agent parses email, pulls Zwayam profile, creates structured task" },
  { from: "Rashmi", to: "Recruiter", whatIsPassed: "Missing document notification / clarification request", format: "Email", trigger: "During verification", agentPotential: "Agent auto-flags missing docs from checklist, sends structured request" },
  { from: "Rashmi", to: "Zoho → TA Head (Nagaraj)", whatIsPassed: "Offer letter for signing", format: "Zwayam → Zoho (automated)", trigger: "After verification complete", agentPotential: "Already automated. Agent monitors signing status." },
  { from: "Zoho", to: "Candidate", whatIsPassed: "Offer letter for candidate signature", format: "Zoho link via email", trigger: "After TA Head signs", agentPotential: "Agent monitors. Auto-reminds after 2 days." },
  { from: "Rashmi", to: "IT Team", whatIsPassed: "Email ID creation tracker", format: "Email with Excel", trigger: "Evening before DOJ", agentPotential: "Agent auto-populates tracker, auto-sends. Post-integration: Darwinbox handles." },
  { from: "Rashmi", to: "Asset vendor", whatIsPassed: "Offer letter release request (Asset payroll contractors)", format: "Email with candidate details + PAN", trigger: "For Asset payroll contractors", agentPotential: "Agent auto-detects Asset payroll flag, auto-generates vendor email" },
  { from: "Rashmi", to: "Prerana/Sasikala/Tamil", whatIsPassed: "Handover: documents placed, welcome mail sent, acknowledgement sent", format: "Teams group chat", trigger: "After all steps complete", agentPotential: "Agent auto-generates handover notification from template" },
  { from: "Rashmi", to: "Ramakrishna (Procurement)", whatIsPassed: "PR sheet updated with contractor details", format: "OneDrive Excel", trigger: "For vendor-sourced hires", agentPotential: "Agent auto-populates PR sheet from Master Joining Sheet" },
  { from: "Rashmi", to: "Umesh (Payroll)", whatIsPassed: "Joining bonus + deferred bonus report", format: "Email with Excel", trigger: "Monthly 17th", agentPotential: "Agent auto-generates from Master Joining Sheet data" },
  { from: "Rashmi", to: "Rajesh", whatIsPassed: "Referral bonus report for approval", format: "Email with Excel", trigger: "Monthly 17th", agentPotential: "Agent auto-generates, cross-checks IEF panel exclusion" },
  { from: "Rashmi", to: "Travel team", whatIsPassed: "Relocation request with candidate details + approval mail", format: "Email", trigger: "Before DOJ for relocation cases", agentPotential: "Agent auto-detects relocation flag, auto-forwards approval to travel team" },
];

export type OfferDeskException = {
  n: number; exception: string; frequency: string; currentHandling: string; escalation: string; agentRecommendation: string;
};

export const OFFER_DESK_EXCEPTIONS: OfferDeskException[] = [
  { n: 1, exception: "Dual employment detected in UAN service history", frequency: "Rare", currentHandling: "Do NOT release offer. Rashmi flags to recruiter. Deviation approval required from managers. If not approved: reject.", escalation: "Rashmi → Recruiter → Manager → Rajesh/Narang", agentRecommendation: "AGENT: Auto-detect overlapping date ranges in UAN history. Auto-block offer trigger. Alert Rashmi + recruiter with structured finding." },
  { n: 2, exception: "Identity mismatch: different person at interview vs candidate", frequency: "Rare (2-3 cases historically)", currentHandling: "IEF screenshots cross-checked against passport photo. If mismatch: offer not released. Reject.", escalation: "Rashmi → TA Head → HR Leadership", agentRecommendation: "AGENT: Can surface IEF screenshots + passport photo side-by-side for easy comparison. Future: facial recognition integration." },
  { n: 3, exception: "Salary deviation from grid", frequency: "Frequent (~20-30% of permanent hires)", currentHandling: "Zwayam auto-triggers 2-level approval (Vasu + Nagaraj) when deviation detected. Rashmi cross-checks manually.", escalation: "Auto-triggered in Zwayam", agentRecommendation: "AGENT: Already automated in Zwayam. Agent can add: verify approval received before allowing offer trigger. Double-check calculation." },
  { n: 4, exception: "Missing documents not uploaded in Zwayam", frequency: "Frequent", currentHandling: "Rashmi emails recruiter. Recruiter follows up with candidate. Offer not processed until complete.", escalation: "Rashmi → Recruiter → Candidate", agentRecommendation: "AGENT: Auto-check Zwayam profile for completeness against hire-type checklist. Auto-send structured missing-doc email to recruiter immediately on request receipt. Saves verification time." },
  { n: 5, exception: "Candidate drops out before joining", frequency: "Regular (~10-15% of offers)", currentHandling: "Rashmi checks with recruiter 2 days before DOJ. If dropout: updates tracker, cancels downstream.", escalation: "Rashmi → Recruiter", agentRecommendation: "AGENT: Auto-check with recruiter 2 days before DOJ. Auto-update tracker. Auto-cancel welcome mail, email ID creation, folder creation." },
  { n: 6, exception: "Email ID exceeds 18 characters", frequency: "Occasional", currentHandling: "Rashmi manually abbreviates name to fit within 18 chars.", escalation: "Rashmi decides abbreviation", agentRecommendation: "AGENT: Auto-check name length. Auto-suggest abbreviation. Flag to Rashmi for confirmation." },
  { n: 7, exception: "Referrer is on interview panel (disqualifies referral bonus)", frequency: "Rare", currentHandling: "Rashmi cross-checks IEF panel names against referrer name. If match: referrer not eligible for bonus.", escalation: "Rashmi flags to Rajesh", agentRecommendation: "AGENT: Auto-cross-check referrer name against IEF panel list. Auto-flag disqualification." },
  { n: 8, exception: "Designation doesn’t match grade (core vs technical designation sets)", frequency: "Occasional", currentHandling: "Rashmi checks designation-grade mapping. If mismatch: flags to recruiter. Cannot process without manager approval.", escalation: "Rashmi → Recruiter → Manager", agentRecommendation: "AGENT: Auto-validate designation against grade-specific list. Auto-block if mismatch. Flag for approval." },
  { n: 9, exception: "Single point of failure: Rashmi", frequency: "Current state", currentHandling: "Rashmi handles all hire types across all 3 locations alone. Umesh is backup but now in payroll. No formal KT.", escalation: "RISK — similar to Sasikala in Offboarding", agentRecommendation: "AGENT: Reduces risk significantly. Most verification + tracker updates + report generation can be automated, leaving only judgment calls for any trained backup." },
];

export type OfferDeskAutomationCategory = {
  category: string; steps: string; pct: string; agentAction: string; timeSaved: string; priority: string;
};

export const OFFER_DESK_AUTOMATION_SUMMARY: OfferDeskAutomationCategory[] = [
  { category: "Fully automatable", steps: "4 steps (1-trigger monitoring, 6, 7, 8, 9)", pct: "36%", agentAction: "Request monitoring, onboarding acknowledgement (being automated), welcome mail, email ID creation, document folder placement. Most being automated by Darwinbox integration.", timeSaved: "~25 hrs/mo (welcome mails ~8hrs + email ID creation ~5hrs + folder management ~5hrs + acknowledgement ~7hrs)", priority: "Medium — most already being automated" },
  { category: "Partially automatable — HIGH VALUE", steps: "3 steps (2, 3, 10)", pct: "27%", agentAction: "Document verification auto-check (completeness + cross-validation), salary grid auto-calculation + rule enforcement, payroll report auto-generation (3 reports on 17th)", timeSaved: "~55 hrs/mo (doc verification ~40hrs + salary verification ~8hrs + payroll reports ~7hrs)", priority: "HIGHEST — build first. Document verification is 40% of Rashmi’s time." },
  { category: "Partially automatable — RULE-BASED", steps: "3 steps (4, 5, 11)", pct: "27%", agentAction: "Master tracker auto-population, offer letter clause verification, dropout auto-detection", timeSaved: "~15 hrs/mo (tracker updates ~10hrs + offer processing ~3hrs + dropout handling ~2hrs)", priority: "HIGH — build with above" },
  { category: "Human-only", steps: "1 step (2 — judgment cases only)", pct: "10%", agentAction: "Edge case document verification: employment gaps, dual employment decisions, non-standard documents, UAN issues", timeSaved: "Stays with humans", priority: "N/A" },
];

export const OFFER_DESK_TOTAL_SAVINGS = "~95 hrs/mo (~80% of Offer Desk time)";

// ---------------------------------------------------------------------
// Track 1 of the enterprise-readiness roadmap ("Prove it"): seed these
// 11 real steps as an actual Scout session instead of only showing them
// on a read-only page, so completeness/GQS/VERDICT/Automation Index come
// from the platform running on this data, not from re-displaying the
// source document's own numbers. Shares the SampleRow shape
// lib/scoutSamples.ts already uses for the generic HR sample, so it goes
// through the exact same POST /scout/sessions/{id}/units call.

const OUTPUT_PREFIXES = ["WRITE", "TRIGGER", "RESPONSE", "SEND"];

/** Same split the page's step cards use: the source's own tagged lines,
 * not a re-interpretation of them. Exported so the page and the sample
 * rows below build from one definition, not two that could drift. */
export function splitOfferDeskDataFields(raw: string): { input: string[]; output: string[] } {
  const input: string[] = [];
  const output: string[] = [];
  for (const line of raw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const prefix = line.split(":")[0];
    if (OUTPUT_PREFIXES.includes(prefix)) output.push(line);
    else input.push(line);
  }
  return { input, output };
}

// Short titles, handoffs, and pain notes aren't their own columns in the
// source spreadsheet -- each is condensed from that step's own "What
// happens" / handoff-map / agent-notes text, not invented. Steps with no
// real quote to ground a pain note keep it empty rather than guess one.
const STEP_TITLES: Record<number, string> = {
  1: "Recruiter sends offer request",
  2: "Verify candidate documents",
  3: "Verify salary approval & calculate deviation",
  4: "Update Master Joining Sheet (+ PR sheet)",
  5: "Trigger offer letter (Zwayam -> Zoho)",
  6: "Send onboarding acknowledgement",
  7: "Send welcome onboard mail",
  8: "Request email ID creation",
  9: "Place documents & notify onboarding team",
  10: "Compile monthly payroll reports",
  11: "Handle candidate drop-out",
};

const STEP_HANDOFFS: Record<number, string> = {
  1: "Recruiter -> Rashmi (Offer Desk)",
  2: "Rashmi -> Recruiter (if docs missing)",
  3: "Rashmi -> Zwayam (auto 2-level approval if deviation)",
  4: "Rashmi -> Procurement (PR sheet, contractors only)",
  5: "Rashmi -> Zwayam -> Zoho -> TA Head -> Candidate",
  6: "Rashmi -> Zoho -> location SPOC -> Candidate",
  7: "Rashmi -> Candidate (cc Onboarding SPOC + recruiter)",
  8: "Rashmi -> IT Team -> reporting manager + Onboarding SPOC",
  9: "Rashmi -> OneDrive + Onboarding team (Teams group chat)",
  10: "Rashmi -> Umesh (Payroll) + Rajesh (referral approval)",
  11: "Rashmi -> Recruiter (dropout confirmation)",
};

const STEP_PAIN: Record<number, string> = {
  2: "Employment verification is the heaviest, most manual part of the role -- ~40% of Rashmi's total time.",
  5: "Deferred bonus vest date must be entered manually (DOJ + 1 year) -- error-prone, flagged by the interviewee.",
  7: "Sent individually per candidate, no mail merge.",
  8: "Email ID must stay <=18 characters -- frequent manual abbreviation.",
  10: "30-45 minutes manually compiling three separate reports every month.",
};

// Range-to-midpoint is only applied where the source itself states a
// numeric range for that step; step 1 has none (it's the recruiter's
// action, not Rashmi's timed work), so it's left unset rather than
// guessed.
const STEP_TIME_MINUTES: Record<number, number | null> = {
  1: null,
  2: 35, // "Permanent: 30-40 min ... employment verification is heaviest" -- the flagged, representative case
  3: 7.5, // "5-10 min"
  4: 7.5, // "5-10 min per candidate"
  5: 7.5, // "5-10 min (mostly automated now)"
  6: 2.5, // "2-3 min (will be automated)"
  7: 2.5, // "2-3 min per candidate"
  8: 5, // "5 min total (batched for all candidates in evening)"
  9: 4, // "3-5 min per candidate"
  10: 37.5, // "30-45 min total (3 reports compiled)"
  11: 5, // "5 min"
};

export type OfferDeskSampleRow = {
  name: string;
  inputs: string;
  outputs: string;
  systems: string;
  frequency: string;
  pain: string;
  handoffs: string;
  decision_rule: string;
  time_minutes: number | null;
};

export const OFFER_DESK_SAMPLE_ROWS: OfferDeskSampleRow[] = OFFER_DESK_STEPS.map((s) => {
  const { input, output } = splitOfferDeskDataFields(s.dataFieldsRaw);
  return {
    name: `${s.step}. ${STEP_TITLES[s.step]}`,
    inputs: input.join("; "),
    outputs: output.join("; "),
    systems: s.system,
    frequency: s.frequency,
    pain: STEP_PAIN[s.step] ?? "",
    handoffs: STEP_HANDOFFS[s.step],
    decision_rule: s.decisionBranches.join("; "),
    time_minutes: STEP_TIME_MINUTES[s.step],
  };
});
