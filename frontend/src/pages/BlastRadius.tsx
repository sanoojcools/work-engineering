import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { BUSINESS_FUNCTIONS, type BlastRadiusItem, type BlastRadiusOut, type BusinessFunctionKey } from "../types";
import { Banner, Loading } from "../ui";

function FunctionSelector({ selected, onSelect }: { selected: BusinessFunctionKey; onSelect: (k: BusinessFunctionKey) => void }) {
  return (
    <div className="tabs" style={{ marginBottom: 4 }}>
      {BUSINESS_FUNCTIONS.map((fn) => (
        <button
          key={fn.key}
          type="button"
          aria-selected={selected === fn.key}
          onClick={() => onSelect(fn.key)}
          style={!fn.active ? { opacity: 0.55 } : undefined}
        >
          {fn.label}
          {!fn.active && <span className="hint" style={{ marginLeft: 6 }}>coming soon</span>}
        </button>
      ))}
    </div>
  );
}

function BlastRadiusMeter({ summary }: { summary: BlastRadiusOut["summary"] }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <strong>
          {summary.selected_count}/{summary.total_sub_functions} sub-functions in scope
        </strong>
        <span className="muted">{summary.selected_pct.toFixed(0)}% of the HR stack</span>
      </div>
      <div className="fn-progress" style={{ height: 6, marginBottom: 6 }}>
        <span style={{ width: `${summary.selected_pct}%`, background: "var(--accent)" }} />
      </div>
      <div className="hint">
        {summary.clusters_touched}/{summary.total_clusters} clusters touched — this is the CHRO's blast-radius scoping
        pass: check what's in scope for this census, name who owns it, then start a Sub-function Lead interview for
        each one.
      </div>
    </div>
  );
}

function SubFunctionCard({
  item, onNeedsKey, onUpdated,
}: {
  item: BlastRadiusItem;
  onNeedsKey: () => void;
  onUpdated: (data: BlastRadiusOut) => void;
}) {
  const nav = useNavigate();
  const [ownerDraft, setOwnerDraft] = useState(item.owner_name);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const data = await apiFetch.patch<BlastRadiusOut>(`/scout/blast-radius/${item.key}`, body);
      onUpdated(data);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ margin: 0, padding: 12 }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={item.in_scope}
          disabled={busy}
          onChange={(e) => void patch({ in_scope: e.target.checked })}
          style={{ marginTop: 3 }}
        />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
      </label>
      <div className="stack" style={{ gap: 6 }}>
        <input
          placeholder="Owner (e.g. Head of TA)"
          value={ownerDraft}
          disabled={busy}
          onChange={(e) => setOwnerDraft(e.target.value)}
          onBlur={() => {
            if (ownerDraft !== item.owner_name) void patch({ owner_name: ownerDraft });
          }}
          style={{ fontSize: 12, padding: "4px 6px" }}
        />
        <select
          value={item.priority}
          disabled={busy}
          onChange={(e) => void patch({ priority: e.target.value })}
          style={{ fontSize: 12, padding: "4px 6px" }}
        >
          <option value="">No priority</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
        </select>
        {item.in_scope && (
          <button
            type="button"
            style={{ fontSize: 12, padding: "4px 6px" }}
            onClick={() =>
              nav("/scout/interview/new", {
                state: { prefillType: "sub_function_lead", prefillName: item.owner_name },
              })
            }
          >
            Start interview →
          </button>
        )}
      </div>
    </div>
  );
}

function HrBlastRadiusGrid() {
  const [data, setData] = useState<BlastRadiusOut | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const out = await apiFetch.get<BlastRadiusOut>("/scout/blast-radius");
      setData(out);
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Failed to load blast radius");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const byCluster = useMemo(() => {
    const map = new Map<string, BlastRadiusItem[]>();
    for (const item of data?.items ?? []) {
      if (!map.has(item.cluster)) map.set(item.cluster, []);
      map.get(item.cluster)!.push(item);
    }
    return [...map.entries()];
  }, [data]);

  if (needsKey) return <ApiKeyBanner onSaved={load} />;
  if (error) return <Banner kind="error">{error}</Banner>;
  if (!data) return <Loading />;

  return (
    <div>
      <BlastRadiusMeter summary={data.summary} />
      <div className="stack" style={{ gap: 20 }}>
        {byCluster.map(([cluster, items]) => (
          <div key={cluster}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>
              {cluster} <span className="muted" style={{ fontWeight: 400 }}>({items.length})</span>
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {items.map((item) => (
                <SubFunctionCard key={item.key} item={item} onNeedsKey={() => setNeedsKey(true)} onUpdated={setData} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BlastRadius() {
  const [fn, setFn] = useState<BusinessFunctionKey>("hr");
  const active = BUSINESS_FUNCTIONS.find((f) => f.key === fn)?.active ?? false;

  return (
    <div>
      <h2>Function Scope</h2>
      <p className="lede">
        Work Engineering is function-agnostic — this build is HR detailed. Selecting a sub-function here sets the
        blast radius for this census and is where a CHRO hands off each area to its Sub-function Lead.
      </p>
      <FunctionSelector selected={fn} onSelect={setFn} />
      {active ? (
        <HrBlastRadiusGrid />
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {BUSINESS_FUNCTIONS.find((f) => f.key === fn)?.label} isn't built yet — HR is the only function with a
            real sub-function catalog and Scout capture behind it today. No placeholder data lives here.
          </p>
        </div>
      )}
    </div>
  );
}
