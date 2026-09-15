/** D-1 FRONTEND: CHRO sitting on Function leader.
 * Keyed: PUT sitting-answers and POST draft-strategy-intent.
 * Guest types in this walk only — never PUT/POST, never mints we-spec-key.
 * Canon (strategy intent, function_head) stays in i-buttons. */

import { api, getSpecKey } from "../api";
import { apiFetch } from "./apiFetch";
import type { HardAnchorsPack, SittingAnswer, SittingAnswers, WorkSystem } from "../types";

export const DRAFT_FOCUS_MIN = 8;

export const CORE_ANSWER_IDS = ["pain", "so_what", "this_period", "in_out", "who_binds"] as const;
export type CoreAnswerId = (typeof CORE_ANSWER_IDS)[number];

export const SITTING_STEPS = [...CORE_ANSWER_IDS, "anchors"] as const;
export type SittingStep = (typeof SITTING_STEPS)[number];

export const PAIN_QUESTION =
  "Think of the last hire that went off the rails between offer and Day-1. What broke?";
export const SO_WHAT_QUESTION =
  "Who owns that? May a helper change it without a named human?";
export const THIS_PERIOD_QUESTION = "What should this period be about, in your own words?";
export const IN_OUT_QUESTION = "What belongs in this sitting, and what is out?";
export const WHO_BINDS_QUESTION = "Who may bind this? Name the person, not a helper.";

export const QUESTION_COPY: Record<CoreAnswerId, string> = {
  pain: PAIN_QUESTION,
  so_what: SO_WHAT_QUESTION,
  this_period: THIS_PERIOD_QUESTION,
  in_out: IN_OUT_QUESTION,
  who_binds: WHO_BINDS_QUESTION,
};

export const USE_AS_LINE = "Use as this period's line";
export const THIS_PERIOD_DRAFT = "This period (draft)";
export const NONE_YET = "none yet.";
export const GUEST_SITTING_LOOK = "Looking only — typing stays in this walk. Confirm is off.";

export const STRATEGY_INTENT_INFO = {
  term: "strategy intent",
  simple: "One line for what this stretch of time is about — not a strategy studio and not a new page.",
  technical:
    "WorkSystem.strategy_intent. POST /work-systems/{id}/draft-strategy-intent (substring of a sitting answer). Confirm is POST /work-systems/{id}/confirm-strategy-intent — name + server time, once. Guest never calls these.",
} as const;

export const FUNCTION_HEAD_INFO = {
  term: "function_head",
  simple: "The person who owns the function sits first. We start from the last hire that broke, not from offer steps.",
  technical:
    "Scout session type=function_head. GET/PUT /api/scout/sessions/{id}/sitting-answers. Guest never calls these.",
} as const;

export function emptyCoreAnswers(): Record<CoreAnswerId, string> {
  return { pain: "", so_what: "", this_period: "", in_out: "", who_binds: "" };
}

export function splitAnswers(list: SittingAnswer[]): {
  core: Record<CoreAnswerId, string>;
  anchors: Record<string, string>;
} {
  const core = emptyCoreAnswers();
  const anchors: Record<string, string> = {};
  for (const row of list) {
    if ((CORE_ANSWER_IDS as readonly string[]).includes(row.id)) {
      core[row.id as CoreAnswerId] = row.text;
    } else if (row.id.startsWith("anchor:")) {
      anchors[row.id.slice("anchor:".length)] = row.text;
    }
  }
  return { core, anchors };
}

export function joinAnswers(
  core: Record<CoreAnswerId, string>,
  anchors: Record<string, string>,
): SittingAnswer[] {
  const rows: SittingAnswer[] = CORE_ANSWER_IDS.map((id) => ({ id, text: core[id] }));
  for (const [key, text] of Object.entries(anchors)) {
    rows.push({ id: `anchor:${key}`, text });
  }
  return rows;
}

export function typedGiven(core: Record<CoreAnswerId, string>): string {
  const lines = CORE_ANSWER_IDS.map((id) => core[id].trim()).filter(Boolean);
  return lines.length ? lines.join(" ") : "Nothing typed yet.";
}

export function lastUsableSentence(
  core: Record<CoreAnswerId, string>,
  current: string,
): string {
  const live = current.trim();
  if (live.length >= DRAFT_FOCUS_MIN) return live;
  if (core.this_period.trim().length >= DRAFT_FOCUS_MIN) return core.this_period.trim();
  for (const id of CORE_ANSWER_IDS) {
    const text = core[id].trim();
    if (text.length >= DRAFT_FOCUS_MIN) return text;
  }
  return live;
}

export function focusInAnswers(focus: string, answers: SittingAnswer[]): boolean {
  return answers.some((row) => row.text.includes(focus) && focus.length >= DRAFT_FOCUS_MIN);
}

export async function getSittingAnswers(sessionId: number): Promise<SittingAnswers> {
  return apiFetch.get<SittingAnswers>(`/scout/sessions/${sessionId}/sitting-answers`);
}

export async function putSittingAnswers(
  sessionId: number,
  answers: SittingAnswer[],
): Promise<SittingAnswers> {
  return apiFetch.put<SittingAnswers>(`/scout/sessions/${sessionId}/sitting-answers`, { answers });
}

export async function draftStrategyIntent(
  workSystemId: number,
  focus: string,
  sourceSessionId: number,
): Promise<WorkSystem> {
  return apiFetch.post<WorkSystem>(`/work-systems/${workSystemId}/draft-strategy-intent`, {
    focus,
    source_session_id: sourceSessionId,
  });
}

/** Pack file, not tenant data. Safe without a key (guest included). */
export async function getHardAnchors(): Promise<HardAnchorsPack> {
  return api.get<HardAnchorsPack>("/packs/hr/hard-anchors", getSpecKey());
}
