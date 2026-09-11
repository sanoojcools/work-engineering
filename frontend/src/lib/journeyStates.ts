/** V10-11 FRONTEND: customer labels for named before/after and this
 * journey's refusals. Canon (admissibility, no_exit, unaffordable_check)
 * stays in i-buttons, not on the glass. */

export const GUEST_STATES_EMPTY = "No states in this walk.";
export const KEYED_STATES_EMPTY = "None named yet.";
export const REFUSALS_EMPTY = "none yet";

export function stateKindLabel(kind: string): string {
  if (kind === "before") return "before";
  if (kind === "after") return "after";
  if (kind === "both") return "before and after";
  return "named";
}

export function refusalReasonLabel(reason: string): string {
  if (reason === "no_exit") return "no finish";
  if (reason === "two_owners") return "two owners";
  if (reason === "unaffordable_check") return "check with no hours";
  return "refused";
}
