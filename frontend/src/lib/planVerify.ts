/** V10-3 Plan columns + V10-5 outcome strip.
 *
 * Reads live GET /work-units/{id}/verification-design,
 * GET /work-units/{id}/certification, and GET /work-systems/{id}/outcome.
 * Guest never calls those endpoints (they 401) and never sees a fabricated
 * "sure" or a invented measured KPI. Predicted / composed pointers cannot
 * display as sure — same rule the API already 422s on write.
 */
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api";
import type {
  Certification,
  CertificationClass,
  FieldPointer,
  IndependenceKind,
  OutcomeRecord,
  Page,
  VerificationDesign,
  VerifyMethod,
  WorkUnit,
} from "../types";
import { apiFetch, NeedsApiKeyError } from "./apiFetch";
import { useIsGuest } from "./guestMode";
import { useCompany } from "../company";
import { OFFER_DESK_META } from "./offerDeskData";

export const SITTING_PROMISED = OFFER_DESK_META.outcome;

export const GUEST_OUTCOME: OutcomeRecord = {
  id: -1,
  work_system_id: -1,
  promised: SITTING_PROMISED,
  measured: null,
  status: "not_measured",
  created_at: "",
  updated_at: "",
};

/** Customer words. Canon names stay in i-buttons. */
export const METHOD_PLAIN: Record<VerifyMethod, string> = {
  document_check: "document check",
  system_of_record: "system of record",
  second_person: "a second person",
  sample: "a sample",
  reconcile: "reconcile",
  model_plus_human: "a model plus a person",
  none: "not stated",
};

export const INDEPENDENT_PLAIN: Record<IndependenceKind, string> = {
  different_lineage: "yes — different lineage",
  deterministic: "yes — deterministic",
  no: "no",
  not_stated: "not stated",
};

export const HOW_SURE_PLAIN: Record<CertificationClass, string> = {
  sure: "sure",
  mostly_sure: "mostly sure",
  reported_not_seen: "reported, not seen",
  cannot_define: "cannot define",
};

export const DUAL_TRACK_COPY = "The do may be delegated. The check stays with a person.";

export type PlanVerifyRow = {
  howSure: string;
  checkedBy: string;
  independent: string;
  dualTrack: boolean;
  blockedFromSure: boolean;
};

export const EMPTY_VERIFY: PlanVerifyRow = {
  howSure: "not stated",
  checkedBy: "not stated",
  independent: "not stated",
  dualTrack: true,
  blockedFromSure: false,
};

const BLOCKS_SURE = new Set(["predicted", "composed"]);

async function getOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch.get<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function mapPool<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Display rule: a predicted or composed pointer cannot read as sure. */
export function howSureLabel(cert: Certification | null, pointers: FieldPointer[]): string {
  if (!cert) return EMPTY_VERIFY.howSure;
  const blocked = pointers.some((p) => BLOCKS_SURE.has(p.status));
  if (cert.class === "sure" && blocked) return "cannot call this sure";
  return HOW_SURE_PLAIN[cert.class];
}

export function viewFromLive(
  design: VerificationDesign | null,
  cert: Certification | null,
  pointers: FieldPointer[],
): PlanVerifyRow {
  return {
    howSure: howSureLabel(cert, pointers),
    checkedBy: design ? METHOD_PLAIN[design.method] : EMPTY_VERIFY.checkedBy,
    independent: design ? INDEPENDENT_PLAIN[design.independent] : EMPTY_VERIFY.independent,
    dualTrack: design?.dual_track ?? true,
    blockedFromSure: cert?.class === "sure" && pointers.some((p) => BLOCKS_SURE.has(p.status)),
  };
}

export async function fetchPlanVerify(workUnitId: number): Promise<PlanVerifyRow> {
  const [design, cert, pointerPage] = await Promise.all([
    getOrNull<VerificationDesign>(`/work-units/${workUnitId}/verification-design`),
    getOrNull<Certification>(`/work-units/${workUnitId}/certification`),
    getOrNull<Page<FieldPointer>>(`/work-units/${workUnitId}/pointers`).then((p) => p?.items ?? []),
  ]);
  return viewFromLive(design, cert, pointerPage);
}

export async function fetchOutcome(workSystemId: number): Promise<OutcomeRecord> {
  return apiFetch.get<OutcomeRecord>(`/work-systems/${workSystemId}/outcome`);
}

export function measuredLabel(outcome: OutcomeRecord): string {
  if (outcome.status === "not_measured" || outcome.measured == null || outcome.measured.trim() === "") {
    return "not measured";
  }
  return outcome.measured;
}

export function usePlanVerify(units: WorkUnit[]) {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const ids = useMemo(() => units.map((u) => u.id), [units]);
  const [byUnit, setByUnit] = useState<Record<number, PlanVerifyRow>>({});
  const [loading, setLoading] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
    if (isGuest || ids.length === 0) {
      setByUnit({});
      setLoading(false);
      setNeedsKey(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    mapPool(ids, 3, async (id) => {
      try {
        return [id, await fetchPlanVerify(id)] as const;
      } catch (err) {
        if (err instanceof NeedsApiKeyError) throw err;
        return [id, EMPTY_VERIFY] as const;
      }
    })
      .then((pairs) => {
        if (cancelled) return;
        const next: Record<number, PlanVerifyRow> = {};
        for (const [id, view] of pairs) next[id] = view;
        setByUnit(next);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, ids.join(","), keyClientId]);

  function forUnit(unit: WorkUnit | null): PlanVerifyRow {
    if (!unit || isGuest) return EMPTY_VERIFY;
    return byUnit[unit.id] ?? EMPTY_VERIFY;
  }

  return { forUnit, loading, needsKey, setNeedsKey };
}

export function usePlanOutcome(workSystemId: number | null) {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const [outcome, setOutcome] = useState<OutcomeRecord>(GUEST_OUTCOME);
  const [loading, setLoading] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
    if (isGuest || workSystemId == null || workSystemId < 1) {
      setOutcome(GUEST_OUTCOME);
      setLoading(false);
      setNeedsKey(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOutcome(workSystemId)
      .then((row) => {
        if (!cancelled) setOutcome(row);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
        else setOutcome(GUEST_OUTCOME);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, workSystemId, keyClientId]);

  return { outcome, loading, needsKey, setNeedsKey, isGuest };
}
