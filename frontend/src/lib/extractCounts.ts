/** V10-12 FRONTEND: four counts from GET /scout/delinquency.
 * Customer words on glass. Canon (delinquency, invention) stays in i-buttons. */
import type { DelinquencyOut } from "../types";

export const ZERO_COUNTS: DelinquencyOut = {
  invention: 0,
  omission: 0,
  distortion: 0,
  flattery: 0,
};

export const GUEST_COUNTS_HINT =
  "You are browsing. Counts stay at zero until someone is signed in and notes are saved.";

export const EXTRACT_COUNT_ROWS = [
  {
    key: "invention",
    label: "invented",
    testId: "extract-count-invented",
    simple:
      "A step that was not in the sitting. We drop it so the list is not padded. Why: a helper must not invent work.",
    technical:
      "GET /api/scout/delinquency · invention. A span that is not a substring of the transcript is dropped and counted.",
  },
  {
    key: "omission",
    label: "left out",
    testId: "extract-count-left-out",
    simple:
      "A step that was in the sitting but did not make the list. Why: we do not quietly skip what they said.",
    technical: "GET /api/scout/delinquency · omission. A sitting span with no matching list row is counted.",
  },
  {
    key: "distortion",
    label: "twisted",
    testId: "extract-count-twisted",
    simple: "Their words were kept but the meaning changed. Why: a helper must not rewrite the job.",
    technical: "GET /api/scout/delinquency · distortion. Same tokens, changed meaning.",
  },
  {
    key: "flattery",
    label: "flattered",
    testId: "extract-count-flattered",
    simple:
      "The draft made the work look cleaner or more automatic than they said. Why: we do not sell a prettier desk.",
    technical: "GET /api/scout/delinquency · flattery. Cleaner or more automatic than the sitting.",
  },
] as const;
