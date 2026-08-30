import { useEffect, useState } from "react";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";

type Contradiction = {
  id: number;
  unit_name: string;
  field: string;
  founder_text: string;
  sme_text: string;
  confidence: number;
  resolution: string;
  status: "open" | "resolved";
  created_at: string;
};

export function ContradictionResolver({ sessionId, onNeedsKey }: { sessionId: number; onNeedsKey: () => void }) {
  const [items, setItems] = useState<Contradiction[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      const page = await apiFetch.get<{ items: Contradiction[] }>(`/scout/contradictions?session_id=${sessionId}`);
      setItems(page.items);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function resolve(id: number) {
    const resolution = drafts[id]?.trim();
    if (!resolution) return;
    setBusyId(id);
    try {
      await apiFetch.post(`/scout/contradictions/${id}/resolve`, { resolution });
      await load();
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusyId(null);
    }
  }

  if (!items) return <p className="health">Checking for contradictions…</p>;

  if (items.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        No contradictions found yet — this compares this session against any other founder/SME session for the same
        company that named the same work unit. Nothing to compare against, or everything agrees.
      </p>
    );
  }

  return (
    <div className="stack">
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Same work unit, different answers — plain text diff, not an AI judgment call. You decide which is real.
      </p>
      {items.map((c) => (
        <div key={c.id} className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <strong>{c.unit_name}</strong>
            <span className="badge">{c.field}</span>
          </div>
          <div className="split" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 10 }}>
            <div style={{ border: "1px solid var(--line)", padding: 10 }}>
              <div className="hint" style={{ marginBottom: 4 }}>Founder said</div>
              <div style={{ fontSize: 13 }}>{c.founder_text}</div>
            </div>
            <div style={{ border: "1px solid var(--line)", padding: 10 }}>
              <div className="hint" style={{ marginBottom: 4 }}>SME said</div>
              <div style={{ fontSize: 13 }}>{c.sme_text}</div>
            </div>
          </div>
          {c.status === "resolved" ? (
            <div className="banner ok">Resolved: {c.resolution}</div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ flex: 1 }}
                placeholder="Which is real? When does each happen?"
                value={drafts[c.id] ?? ""}
                onChange={(e) => setDrafts({ ...drafts, [c.id]: e.target.value })}
              />
              <button
                type="button"
                className="primary"
                disabled={busyId === c.id || !drafts[c.id]?.trim()}
                onClick={() => resolve(c.id)}
              >
                Resolve
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
