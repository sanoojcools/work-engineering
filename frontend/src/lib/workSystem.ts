/** CENSUS-v0 Part B: One Work System (the "missing middle"). This slice
 * ships exactly one journey -- recruiter asks for offer -> offer released
 * -> Day-1 ready -- spanning Offer Desk and Onboarding only. No second
 * journey (e.g. Offboarding) this PR.
 *
 * entry/exit/owner/outcome are not re-typed prose: entry is Offer Desk's
 * own verbatim trigger (offerDeskData.ts), exit is Onboarding's own
 * verbatim outcome (lib/desks/onboarding.ts), and owner reuses the exact
 * stand-in label OFFER_DESK_SEATS already uses for "nobody sat for this
 * seat yet" -- honest, because nobody today owns the cross-desk journey
 * itself; each desk only owns its own half. */
import { apiFetch } from "./apiFetch";
import { OFFER_DESK_SEATS } from "./offerDeskSeats";
import { OFFER_DESK_META } from "./offerDeskData";
import { ONBOARDING_SPEC } from "./desks/onboarding";
import type { WorkSystem } from "../types";

export const OFFER_TO_ONBOARDING_CODE = "WS-OFFER-ONBOARD";

export const OFFER_TO_ONBOARDING_JOURNEY = {
  code: OFFER_TO_ONBOARDING_CODE,
  name: "Recruiter asks for offer → offer released → Day-1 ready",
  entry: OFFER_DESK_META.trigger,
  exit: ONBOARDING_SPEC.outcome,
  owner: OFFER_DESK_SEATS.sub_function_lead.interviewee_name,
  outcome: ONBOARDING_SPEC.outcome,
} as const;

export async function listWorkSystems(): Promise<WorkSystem[]> {
  const page = await apiFetch.get<{ total: number; items: WorkSystem[] }>("/work-systems");
  return page.items;
}

/** Get-or-create: returns the tenant's existing row for this journey if one
 * exists (never overwritten by this call), otherwise creates it candidate. */
export async function ensureOfferToOnboardingWorkSystem(): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>("/work-systems", OFFER_TO_ONBOARDING_JOURNEY);
}

export async function ratifyWorkSystem(id: number, ratifiedBy: string): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>(`/work-systems/${id}/ratify`, { ratified_by: ratifiedBy });
}
