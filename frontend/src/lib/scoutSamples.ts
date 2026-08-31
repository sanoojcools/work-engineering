/** Sample Work Capture Grid rows for demos and for getting a feel for the
 * shape of a good answer.
 *
 * HR & People Ops on purpose: that is the function the Client A census and the
 * shipped sample genome both cover, so a Scout session filled from these sits
 * in the same domain as everything else on screen instead of introducing a
 * second, unrelated story mid-demo.
 *
 * Eight rows because the Genome Strength meter expects 8 work units — loading
 * the full set takes a session to 100% and unlocks Future Preview.
 */
export type SampleRow = {
  name: string;
  inputs: string;
  outputs: string;
  systems: string;
  frequency: string;
  pain: string;
  handoffs: string;
  decision_rule: string;
  time_minutes: number;
};

export const HR_SAMPLE_ROWS: SampleRow[] = [
  {
    name: "Collect joining documents",
    inputs: "Signed offer, candidate email",
    outputs: "Document packet in HRIS",
    systems: "HRIS, Email",
    frequency: "12x/week",
    pain: "Chasing missing documents, no tracker",
    handoffs: "Recruiter -> HR Ops",
    decision_rule: "Escalate if incomplete after 3 days",
    time_minutes: 20,
  },
  {
    name: "Verify documents against offer",
    inputs: "Document packet, signed offer",
    outputs: "Verified checklist",
    systems: "HRIS",
    frequency: "12x/week",
    pain: "Manual line-by-line comparison",
    handoffs: "HR Ops -> HR Ops SPOC",
    decision_rule: "Reject if grade or salary mismatches offer",
    time_minutes: 15,
  },
  {
    name: "Create employee master record",
    inputs: "Verified checklist",
    outputs: "Employee ID issued",
    systems: "Workday",
    frequency: "12x/week",
    pain: "Duplicate records when candidate reapplies",
    handoffs: "HR Ops -> IT",
    decision_rule: "Unique employee ID per PAN",
    time_minutes: 10,
  },
  {
    name: "Provision system access",
    inputs: "Employee ID, role profile",
    outputs: "Accounts active in directory",
    systems: "Active Directory, Okta",
    frequency: "12x/week",
    pain: "Role mapping unclear for new titles",
    handoffs: "IT -> Manager",
    decision_rule: "Manager approval needed above Grade 8",
    time_minutes: 25,
  },
  {
    name: "Run day-one induction",
    inputs: "Joining confirmation, induction deck",
    outputs: "Signed induction checklist",
    systems: "Teams, HRIS",
    frequency: "weekly",
    pain: "Rescheduling when joiners drop out",
    handoffs: "HR Ops -> Manager",
    decision_rule: "Batch if 3+ joiners in one week",
    time_minutes: 90,
  },
  {
    name: "Initiate exit case",
    inputs: "Resignation email",
    outputs: "Exit case open in HRIS",
    systems: "HRIS",
    frequency: "4x/week",
    pain: "Last working day disputed after the fact",
    handoffs: "Manager -> HR Ops",
    decision_rule: "Notice period per grade band",
    time_minutes: 15,
  },
  {
    name: "Revoke access on last day",
    inputs: "Exit case, last working day",
    outputs: "Accounts disabled",
    systems: "Active Directory, Okta",
    frequency: "4x/week",
    pain: "Access sometimes revoked a day early",
    handoffs: "HR Ops -> IT",
    decision_rule: "Revoke at 18:00 on the last working day",
    time_minutes: 10,
  },
  {
    name: "Process full and final settlement",
    inputs: "Exit case, timesheet, recoveries",
    outputs: "Settlement paid",
    systems: "Payroll, HRIS",
    frequency: "4x/week",
    pain: "Recovery amounts arrive late from Finance",
    handoffs: "HR Ops -> Payroll",
    decision_rule: "Hold if recoveries exceed final salary",
    time_minutes: 45,
  },
];
