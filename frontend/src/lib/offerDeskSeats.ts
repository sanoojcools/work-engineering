import { apiFetch } from "./apiFetch";
import { OFFER_DESK_SAMPLE_ROWS } from "./offerDeskData";
import type { Page, ScoutSession } from "../types";
import { INTERVIEW_TYPES } from "../types";

export const OFFER_DESK_SEAT_PATHS = [
  { to: "/scout/offer-desk/function-leader", label: "1. Function leader", seat: "function_head" },
  { to: "/scout/offer-desk/sub-function-lead", label: "2. Sub-function lead", seat: "sub_function_lead" },
  { to: "/scout/offer-desk/rashmi", label: "3. Offer Desk SME", seat: "sme" },
  { to: "/scout/offer-desk/playback", label: "Playback", seat: null },
  { to: "/scout/offer-desk/sheet", label: "Spreadsheet", seat: null },
  { to: "/scout/offer-desk/save-talk-only", label: "Save talk-only", seat: null },
] as const;

export type OfferDeskSeatKey = (typeof INTERVIEW_TYPES)[number];

export const OFFER_DESK_SEATS: Record<
  OfferDeskSeatKey,
  { type: OfferDeskSeatKey; interviewee_name: string; standIn: boolean }
> = {
  function_head: {
    type: "function_head",
    interviewee_name: "CHRO (stand-in)",
    standIn: true,
  },
  sub_function_lead: {
    type: "sub_function_lead",
    interviewee_name: "Head of HR operations (stand-in)",
    standIn: true,
  },
  sme: {
    type: "sme",
    interviewee_name: "Rashmi KN (Offer Desk)",
    standIn: false,
  },
};

const inflight = new Map<OfferDeskSeatKey, Promise<ScoutSession>>();

/** Reuse a sitting of this seat if one already exists for the tenant.
 * Stand-in seats stay empty — no invented units. Rashmi gets the real
 * Offer Desk rows already in offerDeskData.ts, through the same
 * POST /scout/sessions/{id}/units path every Scout session uses. */
export function ensureSeatSession(seat: OfferDeskSeatKey): Promise<ScoutSession> {
  const existing = inflight.get(seat);
  if (existing) return existing;
  const pending = ensureSeatSessionOnce(seat).finally(() => inflight.delete(seat));
  inflight.set(seat, pending);
  return pending;
}

async function ensureSeatSessionOnce(seat: OfferDeskSeatKey): Promise<ScoutSession> {
  const spec = OFFER_DESK_SEATS[seat];
  const page = await apiFetch.get<Page<ScoutSession>>("/scout/sessions");
  let session = page.items.find(
    (s) => s.type === spec.type && s.interviewee_name === spec.interviewee_name,
  );
  if (!session) {
    session = await apiFetch.post<ScoutSession>("/scout/sessions", {
      type: spec.type,
      interviewee_name: spec.interviewee_name,
    });
  }
  if (seat === "sme") {
    session = await seedRashmiRows(session);
  }
  return session;
}

async function seedRashmiRows(session: ScoutSession): Promise<ScoutSession> {
  const have = new Set(session.units.map((u) => u.name.trim().toLowerCase()));
  const pending = OFFER_DESK_SAMPLE_ROWS.filter((r) => !have.has(r.name.toLowerCase()));
  let latest = session;
  for (const row of pending) {
    latest = await apiFetch.post<ScoutSession>(`/scout/sessions/${session.id}/units`, row);
  }
  return latest;
}

/** Stand-in CHRO voice. Sourced from workbook policies / SLA / backup,
 * labelled stand-in until a real function-head sitting exists. Not a quote. */
export const CHRO_STAND_IN = [
  {
    asked: "What must never slip?",
    used: "No offer letter if documents or salary grid are wrong. Dual employment in UAN is a stop, not a shortcut.",
    source: "Workbook policies: UAN dual employment, salary grid · exception 1",
  },
  {
    asked: "What does good look like?",
    used: "Two-hour SLA from recruiter request to offer letter release. One desk covers Bangalore, Hyderabad, Chennai. A backup exists.",
    source: "Workbook: SLA, primary SPOC, backup",
  },
  {
    asked: "What does the CHRO probably not see?",
    used: "Excel as the real system of record. Rashmi as a single point of failure. Umesh already moved to payroll.",
    source: "Workbook systems list, backup row, exception 9",
  },
];

/** Stand-in Head of HR Ops voice. Sourced from handoff map + transition
 * state. Labelled stand-in. Not a recorded sitting. */
export const HR_OPS_STAND_IN = [
  {
    asked: "Where does Offer Desk hand off?",
    used: "Onboarding SPOC by city: Prerana (BLR), Sasikala (HYD), Tamil (CHN). IT for email IDs. Umesh for payroll on the 17th. Asset vendor for some contractors.",
    source: "Workbook: location SPOC branches and handoff map",
  },
  {
    asked: "What is already moving out of the desk?",
    used: "Permanent offer letter already Zwayam → Zoho. EF/MJS and acknowledgement are being automated. Darwinbox is coming — not arrived.",
    source: "Workbook: transition state (what is already moving)",
  },
  {
    asked: "What remains the desk?",
    used: "Document check. Salary grid. Master Joining Sheet. Contractor letters. Monthly bonus reports.",
    source: "Workbook steps 2, 3, 4, 5 (contractor letters), 10",
  },
];

/** Three-column playback. Disagreements stay in their own column. */
export const PLAYBACK_ROWS: { topic: string; function_head: string; sub_function_lead: string; sme: string }[] = [
  {
    topic: "What the work is",
    function_head: "Safe offer, two-hour SLA",
    sub_function_lead: "A desk in a chain of desks",
    sme: "Eleven steps, Excel at the centre",
  },
  {
    topic: "Systems",
    function_head: "Probably an HR system (stand-in — not a recorded sitting)",
    sub_function_lead: "Zwayam, Zoho, Darwinbox coming (not arrived)",
    sme: "Zwayam, Zoho, OneDrive, five Excel trackers, email",
  },
  {
    topic: "Risk",
    function_head: "Wrong offer, dual employment",
    sub_function_lead: "Handoff drop, automation half-done",
    sme: "She is the only person who can run the desk",
  },
];
