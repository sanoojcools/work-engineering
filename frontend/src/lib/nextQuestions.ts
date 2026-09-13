/** SITTING-STEER FRONTEND: Facilitator strip copy.
 * Guest never calls GET /scout/sessions/{id}/next-questions.
 * Keyed [] → no strip. Canon (pack, interrogation) stays in i-buttons. */

export const GUEST_FACILITATOR_EMPTY = "No next questions in this walk.";

export const ASK_THIS_EXACT = "Ask this exact question";

export const FACILITATOR_INFO = {
  term: "Facilitator",
  simple:
    "The next exact question to ask on this sitting. We do not invent one. If there is none, this strip is not shown.",
  technical:
    "GET /api/scout/sessions/{id}/next-questions. text is verbatim from the HR pack question bank. Seat-locked interrogation. Guest never calls this.",
} as const;
