/**
 * V10-8 FRONTEND: sit close — three fields beside the person's words,
 * Confirm / Correct, decision cards from GET. Does not write a table.
 * Guest never calls the API (those 401 without a tenant) and never mints
 * a key.
 *
 * Quotes and drafts below are verbatim sitting / sheet language from
 * offerDeskData.ts / DOCUMENT_CHECK_RECORD, not paraphrases.
 */
import { ApiError } from "../api";
import { apiFetch } from "./apiFetch";
import { OFFER_DESK_META } from "./offerDeskData";
import { DOCUMENT_CHECK_CODE, DOCUMENT_CHECK_RECORD, step2 } from "./offerDeskWorkRecord";
import type {
  DecisionCard,
  FieldPointer,
  FieldRatification,
  FieldRatificationField,
  Page,
  WorkUnit,
} from "../types";

export type SitCloseRowKey = "goal" | "authority" | "acceptance";

export type SitCloseSeed = {
  key: SitCloseRowKey;
  field_name: FieldRatificationField;
  label: string;
  sitting_quote: string;
  drafted_value: string;
};

const sheetStep2 = step2();
const dualEmploymentBranch =
  sheetStep2.decisionBranches.find((b) => b.toLowerCase().includes("dual employment")) ??
  sheetStep2.decisionBranches[sheetStep2.decisionBranches.length - 1];

/** Goal quote is a literal substring of step 2's own whatHappens. */
const GOAL_QUOTE = "Rashmi pulls candidate profile from Zwayam. Checks all documents uploaded.";
if (!sheetStep2.whatHappens.includes(GOAL_QUOTE)) {
  throw new Error("sit-close goal quote is not a substring of the sitting");
}

export const SIT_CLOSE_ROWS: SitCloseSeed[] = [
  {
    key: "goal",
    field_name: "desired_condition",
    label: "goal",
    sitting_quote: GOAL_QUOTE,
    drafted_value: DOCUMENT_CHECK_RECORD.desiredCondition,
  },
  {
    key: "authority",
    field_name: "authority",
    label: "authority",
    sitting_quote: OFFER_DESK_META.primarySpoc,
    drafted_value: DOCUMENT_CHECK_RECORD.owner,
  },
  {
    key: "acceptance",
    field_name: "acceptance_criteria",
    label: "acceptance",
    sitting_quote: dualEmploymentBranch,
    drafted_value: DOCUMENT_CHECK_RECORD.acceptanceCriteria.join(". "),
  },
];

export type SitCloseRowView = SitCloseSeed & {
  ratification: FieldRatification | null;
};

export function pickSitCloseUnit(units: WorkUnit[]): WorkUnit | null {
  return units.find((u) => u.code === DOCUMENT_CHECK_CODE) ?? null;
}

export function mergeSitCloseRows(existing: FieldRatification[]): SitCloseRowView[] {
  const byField = new Map(existing.map((row) => [row.field_name, row]));
  return SIT_CLOSE_ROWS.map((seed) => {
    const ratification = byField.get(seed.field_name) ?? null;
    return {
      ...seed,
      sitting_quote: ratification?.sitting_quote ?? seed.sitting_quote,
      drafted_value: ratification?.drafted_value ?? seed.drafted_value,
      ratification,
    };
  });
}

function declaredQuote(
  pointers: FieldPointer[],
  fieldName: FieldRatificationField,
): string | null {
  const pointer = pointers.find(
    (p) => p.field_name === fieldName && p.status === "declared" && p.quote.trim().length >= 8,
  );
  return pointer ? pointer.quote : null;
}

/** Get-or-create the three drafts. If a declared pointer exists, the quote
 * posted is that pointer's own quote (a substring of itself) so we never
 * invent a quote that would 422. A 409 on a settled row is re-read, not
 * overwritten. */
export async function ensureSitCloseDrafts(workUnitId: number): Promise<FieldRatification[]> {
  const listed = await apiFetch.get<Page<FieldRatification>>(
    `/work-units/${workUnitId}/field-ratifications`,
  );
  let pointers: FieldPointer[] = [];
  try {
    const page = await apiFetch.get<Page<FieldPointer>>(`/work-units/${workUnitId}/pointers`);
    pointers = page.items;
  } catch {
    pointers = [];
  }

  const byField = new Map(listed.items.map((row) => [row.field_name, row]));
  for (const seed of SIT_CLOSE_ROWS) {
    if (byField.has(seed.field_name)) continue;
    const pointerQuote = declaredQuote(pointers, seed.field_name);
    const sitting_quote = pointerQuote ?? seed.sitting_quote;
    try {
      const created = await apiFetch.post<FieldRatification>(
        `/work-units/${workUnitId}/field-ratifications`,
        { field_name: seed.field_name, sitting_quote, drafted_value: seed.drafted_value },
      );
      byField.set(seed.field_name, created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const again = await apiFetch.get<Page<FieldRatification>>(
          `/work-units/${workUnitId}/field-ratifications`,
        );
        for (const row of again.items) byField.set(row.field_name, row);
        continue;
      }
      throw err;
    }
  }
  return SIT_CLOSE_ROWS.map((seed) => byField.get(seed.field_name)).filter(
    (row): row is FieldRatification => Boolean(row),
  );
}

export async function listDecisionCards(workUnitId: number): Promise<DecisionCard[]> {
  const page = await apiFetch.get<Page<DecisionCard>>(`/work-units/${workUnitId}/decision-cards`);
  return page.items;
}

export async function confirmSitCloseField(
  workUnitId: number,
  rid: number,
  confirmedBy: string,
): Promise<FieldRatification> {
  return apiFetch.post<FieldRatification>(`/work-units/${workUnitId}/field-ratifications/${rid}/confirm`, {
    action: "confirm",
    confirmed_by: confirmedBy,
  });
}

export async function correctSitCloseField(
  workUnitId: number,
  rid: number,
  confirmedBy: string,
  value: string,
): Promise<FieldRatification> {
  return apiFetch.post<FieldRatification>(`/work-units/${workUnitId}/field-ratifications/${rid}/confirm`, {
    action: "correct",
    confirmed_by: confirmedBy,
    value,
  });
}
