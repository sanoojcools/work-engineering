/** DEMO SAMPLE only. Facts already on Rashmi's Offer Desk sheet.
 * Not a named leader. Not stored as a confirmed sitting.
 * Default on. ?sample=off is honest empty. */

import { useSearchParams } from "react-router-dom";
import { OFFER_DESK_META } from "./offerDeskData";
import { CORE_ANSWER_IDS, type CoreAnswerId } from "./sittingAnswers";

export const SAMPLE_PACK_BANNER = "Sample pack from Rashmi's sitting. Not a named leader.";
export const SAMPLE_FIELD_LABEL = "Sample — not a named sitting.";

export const PREWORK_DESK = "Offer release, document check, payroll inputs.";
export const PREWORK_SPOC = "Rashmi is the SPOC. Backup is Umesh.";
export const PREWORK_START = OFFER_DESK_META.trigger;
export const PREWORK_STOP =
  "Dual employment detected in UAN: do NOT release offer (deviation approval required).";
export const PREWORK_SYSTEMS = OFFER_DESK_META.systems.map((s) => s.split(" (")[0]).join(", ");

/** Function leader sample — pain-to-permit from the sheet stop, not a named CHRO. */
export const SAMPLE_FUNCTION_LEADER: Record<CoreAnswerId, string> = {
  pain: PREWORK_STOP,
  so_what: "Rashmi (Offer Desk) handles this desk. Umesh takes over when Rashmi is on leave.",
  this_period: "Gaps or dual employment = offer not released without deviation approval.",
  in_out:
    "In: offer release, document check, payroll inputs. Out: lifting dual employment without deviation approval.",
  who_binds: "Rashmi (Offer Desk). Backup is Umesh (was previous Offer Desk owner, now payroll).",
};

export const OPS_ANSWER_IDS = ["trigger", "end", "systems", "cover"] as const;
export type OpsAnswerId = (typeof OPS_ANSWER_IDS)[number];

export const SAMPLE_OPS: Record<OpsAnswerId, string> = {
  trigger: PREWORK_START,
  end: "Candidate handed over to Onboarding SPOC (as per location). Payroll inputs go to Umesh on the 17th.",
  systems: PREWORK_SYSTEMS,
  cover: OFFER_DESK_META.backup,
};

export function useDemoSampleOn(): boolean {
  const [params] = useSearchParams();
  return params.get("sample") !== "off";
}

export function isFunctionLeaderSampleText(id: CoreAnswerId, text: string): boolean {
  return text.trim() === SAMPLE_FUNCTION_LEADER[id];
}

export function isOpsSampleText(id: OpsAnswerId, text: string): boolean {
  return text.trim() === SAMPLE_OPS[id];
}

export function isSampleSentence(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if ((CORE_ANSWER_IDS as readonly string[]).some((id) => SAMPLE_FUNCTION_LEADER[id as CoreAnswerId] === trimmed)) {
    return true;
  }
  return OPS_ANSWER_IDS.some((id) => SAMPLE_OPS[id] === trimmed);
}

export function sampleTextFor(seat: "function_head" | "sub_function_lead" | "sme", id: string): string {
  if (seat === "function_head" && (CORE_ANSWER_IDS as readonly string[]).includes(id)) {
    return SAMPLE_FUNCTION_LEADER[id as CoreAnswerId];
  }
  if (seat === "sub_function_lead") {
    const opsId = OPS_ANSWER_IDS.find((key) => key === id);
    return opsId ? SAMPLE_OPS[opsId] : "";
  }
  return "";
}
