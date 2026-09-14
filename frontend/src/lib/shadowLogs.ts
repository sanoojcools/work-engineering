/** MANDATE-4 FRONTEND: self-reported finish times for Document check
 * (WU-OD-02). Guest never calls GET/POST shadow-logs or shadow-summary
 * and never mints a key. Canon (shadow log, observed) stays in i-buttons.
 * Never add these minutes into 95 or 61.8. */

import { ApiError } from "../api";
import { apiFetch } from "./apiFetch";
import { DOCUMENT_CHECK_CODE } from "./offerDeskWorkRecord";
import type { ShadowLog, WorkUnit } from "../types";

export const MAX_SHADOW_ROWS = 5;
export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 480;

export const GUEST_TIMES_EMPTY = "No times in this walk.";
export const TIMES_LABEL = "Self-reported. Low confidence. Not from the company system.";
export const FIVE_IS_THE_LIMIT = "five is the limit.";
export const MINUTES_NOT_ENTERED = "minutes not entered";
export const NO_UNIT_YET = "This piece of work is not saved on this tenant yet.";
export const NO_TIMES_YET = "No times recorded yet.";

export const TIMES_INFO = {
  term: "Finish times",
  simple:
    "Times someone typed in after they finished this piece of work. Self-reported. Low confidence. Not from the company system. They are never added to 95 or 61.8.",
  technical:
    "GET/POST /api/work-units/{id}/shadow-logs and GET /api/work-units/{id}/shadow-summary. label=self_reported, confidence=low, cap 5 (6th is 422). Not Observed system logs. Guest never calls these.",
} as const;

export function pickDocumentCheckUnit(units: WorkUnit[]): WorkUnit | null {
  return units.find((u) => u.code === DOCUMENT_CHECK_CODE) ?? null;
}

export function formatFinishDate(iso: string): string {
  const stamp = Date.parse(iso);
  if (Number.isNaN(stamp)) return iso;
  return new Date(stamp).toISOString().slice(0, 10);
}

/** Third line: a real sum from the API, or an honest blank. Never guess. */
export function selfReportedMinutesLine(sum: number | null | undefined): string {
  return typeof sum === "number" ? `${sum} minutes` : MINUTES_NOT_ENTERED;
}

export function parseOptionalMinutes(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < MIN_DURATION_MINUTES || n > MAX_DURATION_MINUTES) {
    return "invalid";
  }
  return n;
}

export function dateToOccurredAt(date: string): string {
  return `${date}T00:00:00.000Z`;
}

export function isFiveLimitError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 422) return false;
  return /cap|already has 5/i.test(err.body);
}

export async function createShadowLog(
  workUnitId: number,
  body: { occurred_at: string; duration_minutes?: number },
): Promise<ShadowLog> {
  return apiFetch.post<ShadowLog>(`/work-units/${workUnitId}/shadow-logs`, body);
}
