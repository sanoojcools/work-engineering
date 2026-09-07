/** E -- PLAN, moderation log (docs/BUILD_PROGRAM.md). "Moving S2 toward S3
 * requires reason + name; log it." A thin wrapper over the real
 * GET/POST /moderation endpoints -- reason and name are enforced server-side
 * (schemas/moderation.py, 422 without either), not only greyed out here.
 *
 * This never writes to a VerdictScore or a WorkUnit: it logs an opinion
 * about a scenario replay. Appetite recorded here cannot lift the
 * dual-employment stop or any VERDICT hard gate, and nothing reads this log
 * back into S2/S3 math -- see models/moderation.py's own docstring. */
import { apiFetch } from "./apiFetch";
import type { ModerationEntry, Page } from "../types";

export async function listModerationEntries(): Promise<ModerationEntry[]> {
  const page = await apiFetch.get<Page<ModerationEntry>>("/moderation");
  return page.items;
}

export async function createModerationEntry(input: {
  workUnitCode: string;
  fromLevel: number;
  toLevel: number;
  reason: string;
  moderatedBy: string;
}): Promise<ModerationEntry> {
  return apiFetch.post<ModerationEntry>("/moderation", {
    work_unit_code: input.workUnitCode,
    from_level: input.fromLevel,
    to_level: input.toLevel,
    reason: input.reason,
    moderated_by: input.moderatedBy,
  });
}
