import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getSpecKey, SPEC_KEY_CHANGED } from "./api";
import type { Page } from "./types";

type WhoAmI = { client_id: number; client_slug: string | null; client_name: string | null };

export type Company = {
  id: number;
  slug: string;
  name: string;
  industry: string;
  description: string;
  kind: string;
  work_unit_count: number;
};

const STORAGE = "we-client-id";

type Ctx = {
  clients: Company[];
  client: Company | null;
  /** Tenant the current X-Spec-Key belongs to; null if the key is missing or
   * invalid. Every tenant-scoped read is filtered to this client by RLS
   * regardless of which company is selected here. */
  keyClientId: number | null;
  setClientId: (id: number) => void;
  reload: () => void;
};

const CompanyContext = createContext<Ctx>({
  clients: [],
  client: null,
  keyClientId: null,
  setClientId: () => undefined,
  reload: () => undefined,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Company[]>([]);
  const [clientId, setClientIdState] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  });

  const [keyClientId, setKeyClientId] = useState<number | null>(null);

  /** `followKey` — a newly pasted key should move the view to that key's
   * company. RLS scopes every tenant read to it, so staying on the previous
   * company can only ever render empty. On first load the stored selection is
   * kept instead, so a deliberate choice survives a refresh. */
  function load(followKey = false) {
    // Resolve the key's tenant first: it decides the sensible default. Landing
    // on Catalog while the key belongs to Client A meant every tenant-scoped
    // read was correctly filtered to nothing and the whole screen read 0,
    // which looks like broken data rather than a company mismatch.
    const whoami = api
      .get<WhoAmI>("/org/whoami", getSpecKey())
      .then((w) => w.client_id)
      .catch(() => null);

    Promise.all([api.get<Page<Company>>("/clients/"), whoami])
      .then(([page, ownedId]) => {
        setClients(page.items);
        setKeyClientId(ownedId);
        const owned = ownedId && page.items.some((c) => c.id === ownedId) ? ownedId : null;
        setClientIdState((current) => {
          if (followKey && owned) return owned;
          if (current && page.items.some((c) => c.id === current)) return current;
          if (owned) return owned;
          const firstClient = page.items.find((c) => c.kind === "client");
          return firstClient?.id ?? page.items[0]?.id ?? null;
        });
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
    // Pasting a different tenant's key has to re-resolve which company the
    // session is actually authenticated as; otherwise the switcher keeps
    // showing the previous tenant and its pages render empty.
    const onKeyChange = () => load(true);
    window.addEventListener(SPEC_KEY_CHANGED, onKeyChange);
    return () => window.removeEventListener(SPEC_KEY_CHANGED, onKeyChange);
  }, []);

  useEffect(() => {
    if (clientId) localStorage.setItem(STORAGE, String(clientId));
  }, [clientId]);

  const client = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  return (
    <CompanyContext.Provider
      value={{
        clients,
        client,
        keyClientId,
        setClientId: (id) => setClientIdState(id),
        reload: load,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
