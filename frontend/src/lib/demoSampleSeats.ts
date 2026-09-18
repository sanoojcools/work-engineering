/** DEMO SAMPLE only. Facts already on Rashmi's Offer Desk sheet.
 * Not a named leader. Not stored as a confirmed sitting.
 * Default on. ?sample=off is honest empty. */

import { useSearchParams } from "react-router-dom";
import { CORE_ANSWER_IDS, type CoreAnswerId } from "./sittingAnswers";

export const SAMPLE_PACK_BANNER = "Sample pack from Rashmi's sitting. Not a named leader.";
export const SAMPLE_FIELD_LABEL = "Sample — not a named sitting.";

export const PREWORK_DESK = "Offer release, document check, payroll inputs.";
export const PREWORK_SPOC = "Rashmi is the SPOC. Backup is Umesh.";
export const PREWORK_START = "A case starts with recruiter mail and a candidate profile in Zwayam.";
export const PREWORK_STOP =
  "UAN dual employment or a gap: no offer without a named deviation.";
export const PREWORK_SYSTEMS = "Zwayam, Zoho, OneDrive, Excel, Email.";

/** Function leader sample — pain-to-permit from the sheet stop, not a named CHRO. */
export const SAMPLE_FUNCTION_LEADER: Record<CoreAnswerId, string> = {
  pain: "Dual employment in UAN was missed after the offer was moving.",
  so_what: "A helper may not lift that stop. It stays with a named human.",
  this_period: "This period is the UAN stop, not a faster letter.",
  in_out:
    "In: offer release, document check, payroll inputs. Out: lifting the UAN dual-employment stop without a named deviation.",
  who_binds: "A named human. A helper may not bind the UAN stop.",
};

export const OPS_ANSWER_IDS = ["ops_trigger", "ops_end", "ops_systems", "ops_cover"] as const;
export type OpsAnswerId = (typeof OPS_ANSWER_IDS)[number];

export const OPS_QUESTION_COPY: Record<OpsAnswerId, string> = {
  ops_trigger: "When does a case start on this desk?",
  ops_end: "When is the desk done?",
  ops_systems: "Which systems does this desk use?",
  ops_cover: "Who covers when the SPOC is out?",
};

export const OPS_TOPIC_LABELS: Record<OpsAnswerId, string> = {
  ops_trigger: "Trigger",
  ops_end: "End",
  ops_systems: "Systems",
  ops_cover: "Cover",
};

export const SAMPLE_OPS: Record<OpsAnswerId, string> = {
  ops_trigger:
    "Recruiter sends offer request email with salary approval attachment and candidate profile in Zwayam.",
  ops_end:
    "Candidate handed to the location Onboarding SPOC. Payroll inputs go to Umesh on the 17th.",
  ops_systems: "Zwayam, Zoho, OneDrive, Excel, Email.",
  ops_cover: "Umesh was previous Offer Desk owner, now payroll. Takes over when Rashmi is on leave.",
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
