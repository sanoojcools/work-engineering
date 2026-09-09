/** D -- INTENT-LITE (docs/BUILD_PROGRAM.md) plus V10-9's period focus.
 * Function and Work System intents are drafted from existing sheet/sitting
 * text only -- no invented COO strategy, no strategy constitution. V10-9
 * adds one more line on the same Work System row (the period's focus),
 * shown as a single Plan row, never a studio. All three attach to the one
 * Work System this app ships (workSystem.ts's OFFER_TO_ONBOARDING_JOURNEY).
 *
 * Function intent (HR operations) -- outcome + owner + measure -- reuses
 * PLAYBACK_ROWS' own "What the work is" / function_head cell verbatim
 * (offerDeskSeats.ts) rather than retyping a paraphrase of it, and the
 * owner reuses the exact stand-in label OFFER_DESK_SEATS already uses for
 * the sub_function_lead seat. The measure is PARSED off OFFER_DESK_META's
 * own T&M sheet field (offerDeskData.ts's `frequency`, transcribed from
 * OfferDesk_Agent_Ready.xlsx) rather than retyped, so a sheet that stopped
 * stating an SLA would honestly fall back to "not stated" instead of a
 * stale hardcoded string silently drifting from the source.
 *
 * Work System intent -- what this journey is for, in sheet words -- is the
 * one new verbatim transcription this file adds: a direct quote from the
 * Function Head interview transcript (CHRO stand-in), Q1,
 * offer-desk-inputs/01-interviews/function-head-interview-chro.md. That
 * file is sitting text like everything else this walk already transcribes
 * (offerDeskData.ts, offerDeskSeats.ts) -- not imported at runtime (it's a
 * markdown source doc, like the desks/*.xlsx sheets those files transcribe
 * from), so its wording is copied here the same way, with the same
 * "verbatim, not paraphrased" discipline the rest of this codebase holds
 * itself to. Owner reuses the same Head of HR Ops stand-in, per that same
 * interview's Q3: "HR Operations reports through the Head of HR Ops, who
 * owns the desk's SLAs and escalation path." */
import { OFFER_DESK_META } from "./offerDeskData";
import { OFFER_DESK_SEATS, PLAYBACK_ROWS } from "./offerDeskSeats";

const SLA_CLAUSE_RE = /SLA:[^.]+\./;

/** Real parse, not a retyped literal -- see module doc comment. Returns
 * "not stated" (never a fabricated figure) if the sheet's own frequency
 * field ever stops naming an SLA clause in this shape. */
export function extractSlaMeasure(tAndMFrequencyField: string): string {
  const match = SLA_CLAUSE_RE.exec(tAndMFrequencyField);
  return match ? match[0] : "not stated";
}

const WHAT_THE_WORK_IS = PLAYBACK_ROWS.find((r) => r.topic === "What the work is");
if (!WHAT_THE_WORK_IS) {
  throw new Error("offerDeskSeats.ts PLAYBACK_ROWS is missing its 'What the work is' row");
}

export const FUNCTION_INTENT_DRAFT = {
  function: "HR operations",
  outcome: WHAT_THE_WORK_IS.function_head,
  owner: OFFER_DESK_SEATS.sub_function_lead.interviewee_name,
  measure: extractSlaMeasure(OFFER_DESK_META.frequency),
  source: "Function Head interview (CHRO stand-in), Q1 'good looks like' + PLAYBACK_ROWS · OFFER_DESK_META.frequency (T&M sheet)",
} as const;

export const WORK_SYSTEM_INTENT_DRAFT = {
  purpose:
    "If Offer Desk stalls, we don't lose a hire in one day — we lose it over two weeks, quietly, as candidates walk to other offers.",
  owner: OFFER_DESK_SEATS.sub_function_lead.interviewee_name,
  source: "Function Head interview (CHRO stand-in), Q1, offer-desk-inputs/01-interviews/function-head-interview-chro.md",
} as const;

/** V10-9. One-line period focus persisted on first ensure, same sentence
 * the backend tests already use — stand-in owner until a real sponsor.
 * Plan shows this as "This period:"; the canon name lives in the i-button. */
export const STRATEGY_INTENT_DRAFT = {
  focus: "This quarter: cut offer-to-Day-1 cycle time, not headcount.",
  owner: OFFER_DESK_SEATS.sub_function_lead.interviewee_name,
  source: "V10-9 period focus on the existing work_systems row — not a new intent table",
} as const;
