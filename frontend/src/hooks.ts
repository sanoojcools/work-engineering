import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, getSpecKey } from "./api";
import { useCompany } from "./company";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  // Signing in, or switching tenants, changes what every one of these requests
  // returns — a page loaded before the key existed otherwise keeps showing the
  // empty result it got then (Overview sat on "0 work units" immediately after
  // demo setup had just seeded twelve).
  //
  // Keyed on the *resolved* tenant rather than the raw key-change event: on a
  // switch the event fires before /org/whoami comes back, so refetching then
  // reissues every request under the previous tenant's client_id, which the
  // cross-tenant guards correctly answer with a 404. Waiting for the resolved
  // id means one refetch, after the tenant is actually known.
  const { keyClientId } = useCompany();

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      // Always send the org key. Slice 3 PR 3a moved /work-units, /spec and
      // /census onto per-org X-Spec-Key, but this hook never sent one, so
      // Overview, Discovery and Economics all 401'd on /work-units/ and
      // silently rendered 0 — Overview's headline "Work Units" tile read 0
      // on a fully seeded tenant. Routes that don't authenticate ignore the
      // header, so sending it unconditionally is safe.
      .get<T>(path, getSpecKey())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick, keyClientId]);

  return { data, error, loading, reload };
}
