import { apiFetch } from "./apiFetch";
import { OFFER_DESK_SAMPLE_ROWS } from "./offerDeskData";
import type { Page, ScoutSession } from "../types";
import { INTERVIEW_TYPES } from "../types";

export const OFFER_DESK_SEAT_PATHS = [
  { to: "/scout/offer-desk/function-leader", label: "1. Function leader", seat: "function_head" },
  { to: "/scout/offer-desk/sub-function-lead", label: "2. Sub-function lead", seat: "sub_function_lead" },
  { to: "/scout/offer-desk/rashmi", label: "3. Offer Desk SME", seat: "sme" },
  { to: "/scout/offer-desk/playback", label: "Playback", seat: null },
  { to: "/scout/offer-desk/sit-close", label: "Sit close", seat: null },
  { to: "/scout/offer-desk/sheet", label: "Spreadsheet", seat: null },
  { to: "/scout/offer-desk/save-talk-only", label: "Save talk-only", seat: null },
  { to: "/scout/offer-desk/evidence-pack", label: "With evidence (sample)", seat: null },
  { to: "/scout/offer-desk/how-we-cut", label: "How we cut it", seat: null },
  { to: "/scout/offer-desk/document-check", label: "Document check", seat: null },
  { to: "/scout/offer-desk/work-graph", label: "Work Graph", seat: null },
  { to: "/scout/offer-desk/gap", label: "Gap", seat: null },
  { to: "/scout/offer-desk/hours", label: "Hours", seat: null },
  { to: "/scout/offer-desk/spec-deny", label: "Spec deny", seat: null },
  { to: "/scout/offer-desk/sitting-record", label: "Sitting record", seat: null },
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

/** Designed empty Ops room. Not a stand-in sitting and not an intent owner. */
export const OPS_HAS_NOT_SAT = "Ops has not sat";

export const OPS_EMPTY_SLOTS = [
  { id: "trigger", label: "What starts this desk's work" },
  { id: "end", label: "What counts as done" },
  { id: "systems", label: "Systems on this tenant" },
  { id: "cover", label: "Who covers when they are out" },
] as const;

/** Three-column playback constants. Playback glass reads stored answers;
 * these rows stay the sheet-derived source for intent drafts only. */
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
