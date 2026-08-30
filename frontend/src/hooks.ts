import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, getSpecKey } from "./api";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

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
  }, [path, tick]);

  return { data, error, loading, reload };
}
