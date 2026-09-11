/** V10-12 FRONTEND: four counts from GET /scout/delinquency.
 * Customer words on glass. Canon (delinquency, invention) stays in i-buttons. */
import type { DelinquencyOut } from "../types";

export const ZERO_COUNTS: DelinquencyOut = {
  invention: 0,
  omission: 0,
  distortion: 0,
  flattery: 0,
};

export const GUEST_COUNTS_HINT = "looking only";

export const EXTRACT_COUNT_ROWS = [
  {
    key: "invention",
    label: "invented",
    testId: "extract-count-invented",
  },
  {
    key: "omission",
    label: "left out",
    testId: "extract-count-left-out",
  },
  {
    key: "distortion",
    label: "twisted",
    testId: "extract-count-twisted",
  },
  {
    key: "flattery",
    label: "flattered",
    testId: "extract-count-flattered",
  },
] as const;
