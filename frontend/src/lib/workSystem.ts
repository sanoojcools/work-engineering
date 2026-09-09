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
 * itself; each desk only owns its own half.
 *
 * INTENT-PLAN adds: the two D -- INTENT-LITE intents (lib/intent.ts) sent
 * once at ensure time alongside entry/exit/owner/outcome, confirm calls for
 * each, and a shared useWorkSystem() hook so Work Chart and Plan don't each
 * carry their own copy of the same ensure/loading/error/needsKey plumbing.
 * V10-9 adds the period-focus line on the same ensure payload, confirmed
 * from Plan via POST /work-systems/{id}/confirm-strategy-intent. */
import { useEffect, useState } from "react";
import { apiFetch, NeedsApiKeyError } from "./apiFetch";
import { useIsGuest } from "./guestMode";
import { OFFER_DESK_SEATS } from "./offerDeskSeats";
import { OFFER_DESK_META } from "./offerDeskData";
import { ONBOARDING_SPEC } from "./desks/onboarding";
import { FUNCTION_INTENT_DRAFT, STRATEGY_INTENT_DRAFT, WORK_SYSTEM_INTENT_DRAFT } from "./intent";
import { useCompany } from "../company";
import type { IntentOut, WorkSystem } from "../types";

export const OFFER_TO_ONBOARDING_CODE = "WS-OFFER-ONBOARD";

export const OFFER_TO_ONBOARDING_JOURNEY = {
  code: OFFER_TO_ONBOARDING_CODE,
  name: "Recruiter asks for offer → offer released → Day-1 ready",
  entry: OFFER_DESK_META.trigger,
  exit: ONBOARDING_SPEC.outcome,
  owner: OFFER_DESK_SEATS.sub_function_lead.interviewee_name,
  outcome: ONBOARDING_SPEC.outcome,
} as const;

const ENSURE_BODY = {
  ...OFFER_TO_ONBOARDING_JOURNEY,
  function_intent_outcome: FUNCTION_INTENT_DRAFT.outcome,
  function_intent_owner: FUNCTION_INTENT_DRAFT.owner,
  function_intent_measure: FUNCTION_INTENT_DRAFT.measure,
  work_system_intent_purpose: WORK_SYSTEM_INTENT_DRAFT.purpose,
  work_system_intent_owner: WORK_SYSTEM_INTENT_DRAFT.owner,
  strategy_intent_focus: STRATEGY_INTENT_DRAFT.focus,
  strategy_intent_owner: STRATEGY_INTENT_DRAFT.owner,
} as const;

/** Same em dash services/work_system.py sends when an intent has no owner. */
export const UNOWNED_OWNER = "—";

export function ownerOrDash(owner: string | null | undefined): string {
  const trimmed = (owner ?? "").trim();
  return trimmed && trimmed !== UNOWNED_OWNER ? trimmed : UNOWNED_OWNER;
}

function intentDebtFromOwners(...owners: string[]): number {
  return owners.filter((owner) => !owner.trim()).length;
}

/** Guest / not-yet-ensured preview of both intents -- same draft text a
 * keyed tenant's first ensure call would persist, shown read-only. Never
 * looks confirmed: status is always "draft", confirmed_by/_at always empty. */
const GUEST_FUNCTION_INTENT: IntentOut = {
  label: FUNCTION_INTENT_DRAFT.outcome,
  owner: FUNCTION_INTENT_DRAFT.owner,
  measure: FUNCTION_INTENT_DRAFT.measure,
  status: "draft",
  confirmed_by: "",
  confirmed_at: null,
};

const GUEST_WORK_SYSTEM_INTENT: IntentOut = {
  label: WORK_SYSTEM_INTENT_DRAFT.purpose,
  owner: WORK_SYSTEM_INTENT_DRAFT.owner,
  measure: null,
  status: "draft",
  confirmed_by: "",
  confirmed_at: null,
};

const GUEST_STRATEGY_INTENT: IntentOut = {
  label: STRATEGY_INTENT_DRAFT.focus,
  owner: STRATEGY_INTENT_DRAFT.owner,
  measure: null,
  status: "draft",
  confirmed_by: "",
  confirmed_at: null,
};

/** The same declared-schematic fallback useWorkSystem() renders for a
 * guest, exported so lib/censusExport.ts (CENSUS-PACK P1) can build a
 * guest export without a hook -- one shape, not a second one invented for
 * the download. */
export const GUEST_JOURNEY: WorkSystem = {
  id: -1,
  ...OFFER_TO_ONBOARDING_JOURNEY,
  status: "candidate",
  ratified_by: "",
  ratified_at: null,
  created_at: "",
  function_intent: GUEST_FUNCTION_INTENT,
  work_system_intent: GUEST_WORK_SYSTEM_INTENT,
  strategy_intent: GUEST_STRATEGY_INTENT,
  intent_debt: intentDebtFromOwners(
    GUEST_FUNCTION_INTENT.owner,
    GUEST_WORK_SYSTEM_INTENT.owner,
    GUEST_STRATEGY_INTENT.owner,
  ),
};

export async function listWorkSystems(): Promise<WorkSystem[]> {
  const page = await apiFetch.get<{ total: number; items: WorkSystem[] }>("/work-systems");
  return page.items;
}

/** Get-or-create: returns the tenant's existing row for this journey if one
 * exists (never overwritten by this call), otherwise creates it candidate,
 * both intents drafted and unconfirmed. */
export async function ensureOfferToOnboardingWorkSystem(): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>("/work-systems", ENSURE_BODY);
}

export async function ratifyWorkSystem(id: number, ratifiedBy: string): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>(`/work-systems/${id}/ratify`, { ratified_by: ratifiedBy });
}

/** "Confirm as owner" -- name + server timestamp is the whole write. Text
 * fields never change here (see routers/work_systems.py's own comment). */
export async function confirmFunctionIntent(id: number, confirmedBy: string): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>(`/work-systems/${id}/confirm-function-intent`, { confirmed_by: confirmedBy });
}

export async function confirmWorkSystemIntent(id: number, confirmedBy: string): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>(`/work-systems/${id}/confirm-work-system-intent`, { confirmed_by: confirmedBy });
}

export async function confirmStrategyIntent(id: number, confirmedBy: string): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>(`/work-systems/${id}/confirm-strategy-intent`, { confirmed_by: confirmedBy });
}

/** Shared by Work Chart (purpose strip + Ratify) and Plan (units + intent
 * summary): one ensure call per mount, guest-safe draft fallback so both
 * pages render the same declared-schematic without a live call. */
export function useWorkSystem() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const [workSystem, setWorkSystem] = useState<WorkSystem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setWorkSystem(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    ensureOfferToOnboardingWorkSystem()
      .then((ws) => {
        if (!cancelled) setWorkSystem(ws);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
        else setError(err instanceof Error ? err.message : "Could not load the Work System");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, keyClientId]);

  const journey: WorkSystem = workSystem ?? GUEST_JOURNEY;

  return { isGuest, workSystem, journey, loading, error, needsKey, setNeedsKey, setWorkSystem, setError };
}
