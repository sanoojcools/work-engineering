/** Offer Desk sample rows for the SME sitting. Source = OFFER_DESK_STEPS only. */

import { OFFER_DESK_STEPS } from "./offerDeskData";
import type { SampleRow } from "./scoutSamples";

function minutesFrom(text: string): number | null {
  const range = text.match(/(\d+)\s*-\s*(\d+)\s*min/i);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const one = text.match(/(\d+(?:\.\d+)?)\s*min/i);
  if (one) return Math.round(Number(one[1]));
  return null;
}

export const OFFER_DESK_SAMPLE_ROWS: SampleRow[] = OFFER_DESK_STEPS.map((s) => ({
  name: s.whatHappens.split(/[.\n]/)[0].slice(0, 90),
  inputs: s.dataFieldsRaw,
  outputs: "",
  systems: s.system,
  frequency: s.frequency,
  pain: "",
  handoffs: "",
  decision_rule: s.decisionBranches.join("; "),
  time_minutes: minutesFrom(s.timePerCase),
}));
