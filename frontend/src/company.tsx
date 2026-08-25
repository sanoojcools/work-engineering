import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Page } from "./types";

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
  setClientId: (id: number) => void;
  reload: () => void;
};

const CompanyContext = createContext<Ctx>({
  clients: [],
  client: null,
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

  function load() {
    api.get<Page<Company>>("/clients/").then((page) => {
      setClients(page.items);
      setClientIdState((current) => {
        if (current && page.items.some((c) => c.id === current)) return current;
        const catalog = page.items.find((c) => c.slug === "catalog");
        return catalog?.id ?? page.items[0]?.id ?? null;
      });
    }).catch(() => undefined);
  }

  useEffect(() => {
    load();
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
