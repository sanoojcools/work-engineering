/** V10-1 FRONTEND: census record + readiness from GET /api/censuses.
 *
 * Guest: never calls the API (it 401s without a real key) and never mints
 * one. Strip renders EMPTY_READINESS — all three rows red, counts zero.
 * Keyed: GET the tenant's rows; Start is POST ensure + POST /{id}/start
 * against the Offer→Day-1 Work System. Readiness booleans are whatever the
 * server computed from existing consent / three seats / uploaded files —
 * this module does not invent a document-received flag.
 */
import { useEffect, useState } from "react";
import { apiFetch, NeedsApiKeyError } from "./apiFetch";
import { useIsGuest } from "./guestMode";
import { useCompany } from "../company";
import { ensureOfferToOnboardingWorkSystem } from "./workSystem";
import type { CensusReadiness, CensusRecord, Page } from "../types";

export const EMPTY_READINESS: CensusReadiness = {
  consent: false,
  consent_receipt_count: 0,
  people: false,
  people_seats_filled: 0,
  people_seats_total: 3,
  docs: false,
  docs_uploaded_count: 0,
};

export async function listCensuses(): Promise<CensusRecord[]> {
  const page = await apiFetch.get<Page<CensusRecord>>("/censuses");
  return page.items;
}

export async function ensureCensus(workSystemId: number): Promise<CensusRecord> {
  return apiFetch.post<CensusRecord>("/censuses", { work_system_id: workSystemId });
}

export async function startCensus(id: number): Promise<CensusRecord> {
  return apiFetch.post<CensusRecord>(`/censuses/${id}/start`);
}

/** Start (or re-read) the Offer→Day-1 census: ensure the Work System, get-or-create
 * the census row, then POST start. A 409 "already started" re-reads GET so the
 * screen still settles on the persisted started row. */
export async function startOfferToOnboardingCensus(): Promise<CensusRecord> {
  const ws = await ensureOfferToOnboardingWorkSystem();
  const row = await ensureCensus(ws.id);
  if (row.status === "started") return row;
  try {
    return await startCensus(row.id);
  } catch (err) {
    if (err instanceof Error && /already started/i.test(err.message)) {
      const items = await listCensuses();
      const existing = items.find((c) => c.id === row.id);
      if (existing) return existing;
    }
    throw err;
  }
}

export function useCensus() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const [census, setCensus] = useState<CensusRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setCensus(null);
      setLoading(false);
      setError(null);
      setNeedsKey(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCensuses()
      .then((items) => {
        if (!cancelled) setCensus(items[0] ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
        else setError(err instanceof Error ? err.message : "Could not load censuses");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, keyClientId]);

  const readiness: CensusReadiness = census?.readiness ?? EMPTY_READINESS;

  return {
    isGuest,
    census,
    readiness,
    loading,
    error,
    needsKey,
    setNeedsKey,
    setCensus,
    setError,
  };
}
