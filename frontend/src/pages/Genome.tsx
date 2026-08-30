import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import type { AutomationIndex, BoWorkUnit, BusinessObject, WorkUnitFull } from "../types";
import { Banner, Loading } from "../ui";

type GqsDetail = {
  version_id: number;
  gqs: number | null;
  gates_passed: string[];
  gates_failed: unknown[];
  work_unit_count: number;
  ratified: boolean;
};

export default function Genome() {
  const { versionId } = useParams<{ versionId: string }>();
  const vid = Number(versionId);

  const [gqs, setGqs] = useState<GqsDetail | null>(null);
  const [businessObjects, setBusinessObjects] = useState<BusinessObject[] | null>(null);
  const [selectedBo, setSelectedBo] = useState<string | null>(null);
  const [boUnits, setBoUnits] = useState<BoWorkUnit[] | null>(null);
  const [selectedWu, setSelectedWu] = useState<WorkUnitFull | null>(null);
  const [tab, setTab] = useState<"business-objects" | "automation-index">("business-objects");
  const [automationIndex, setAutomationIndex] = useState<AutomationIndex | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof NeedsApiKeyError) {
        setNeedsKey(true);
      } else {
        setError(err instanceof Error ? err.message : "Request failed");
      }
      return null;
    }
  }

  async function loadCore() {
    const g = await handle(() => apiFetch.get<GqsDetail>(`/genome/${vid}/gqs`));
    if (g) setGqs(g);
    const bos = await handle(() => apiFetch.get<{ business_objects: BusinessObject[] }>(`/genome/${vid}/business-objects`));
    if (bos) setBusinessObjects(bos.business_objects);
  }

  useEffect(() => {
    void loadCore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vid]);

  async function openBo(name: string) {
    setSelectedBo(name);
    setSelectedWu(null);
    setBoUnits(null);
    const units = await handle(() =>
      apiFetch.get<{ work_units: BoWorkUnit[] }>(`/genome/${vid}/business-objects/${encodeURIComponent(name)}/work-units`)
    );
    if (units) setBoUnits(units.work_units);
  }

  async function openWu(code: string) {
    const wu = await handle(() => apiFetch.get<WorkUnitFull>(`/genome/${vid}/work-units/${code}`));
    if (wu) setSelectedWu(wu);
  }

  async function loadAutomationIndex() {
    if (automationIndex) return;
    const idx = await handle(() => apiFetch.get<AutomationIndex>(`/genome/${vid}/automation-index`));
    if (idx) setAutomationIndex(idx);
  }

  async function ratifyWhole() {
    setBusy(true);
    const result = await handle(() => apiFetch.post<{ ratified: boolean }>(`/genome/${vid}/ratify`, {}));
    setBusy(false);
    if (result) void loadCore();
  }

  async function ratifyBo(name: string) {
    setBusy(true);
    await handle(() => apiFetch.post(`/genome/${vid}/ratify`, { business_object: name }));
    setBusy(false);
    await loadCore();
    await openBo(name);
  }

  if (needsKey) {
    return (
      <div>
        <h2>Genome {vid}</h2>
        <ApiKeyBanner onSaved={() => { setNeedsKey(false); void loadCore(); }} />
      </div>
    );
  }

  if (error) return <Banner kind="error">{error}</Banner>;
  if (!gqs || !businessObjects) return <Loading />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Genome v{vid}</h2>
        <span className={`badge ${gqs.gqs !== null && gqs.gqs >= 90 ? "ok" : ""}`}>
          GQS {gqs.gqs !== null ? gqs.gqs.toFixed(1) : "—"}
        </span>
        <span className="badge">{gqs.work_unit_count} work units</span>
        {gqs.ratified ? <span className="badge ok">Ratified</span> : <span className="badge">Not ratified</span>}
      </div>
      <p className="lede">
        Gates passed: {gqs.gates_passed.join(", ") || "none"}.{" "}
        {!gqs.ratified && (
          <button type="button" disabled={busy} onClick={ratifyWhole} style={{ marginLeft: 8 }}>
            Ratify whole version
          </button>
        )}
      </p>

      <div className="tabs">
        <button aria-selected={tab === "business-objects"} onClick={() => setTab("business-objects")}>
          Business Objects
        </button>
        <button
          aria-selected={tab === "automation-index"}
          onClick={() => {
            setTab("automation-index");
            void loadAutomationIndex();
          }}
        >
          Automation Index
        </button>
      </div>

      {tab === "business-objects" && (
        <div className="split" style={{ gridTemplateColumns: "0.9fr 1.1fr" }}>
          <div>
            <h3>Business objects (L1)</h3>
            <div className="stack">
              {businessObjects.map((bo) => (
                <div
                  key={bo.name}
                  className="card"
                  style={{ margin: 0, cursor: "pointer", borderColor: selectedBo === bo.name ? "var(--accent)" : undefined }}
                  onClick={() => void openBo(bo.name)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{bo.name}</strong>
                    <span className={`badge ${bo.ratified ? "ok" : ""}`}>{bo.ratified ? "ratified" : "pending"}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {bo.work_unit_count} work unit{bo.work_unit_count === 1 ? "" : "s"}
                    {bo.needs_state_machine && " · no state machine yet"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {!selectedBo && <p className="health">Select a business object to see its work units (L2).</p>}
            {selectedBo && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0 }}>{selectedBo} (L2)</h3>
                  <button type="button" disabled={busy} onClick={() => void ratifyBo(selectedBo)}>
                    Ratify this object
                  </button>
                </div>
                {!boUnits && <p className="health">Loading…</p>}
                {boUnits && (
                  <div className="table-wrap" style={{ marginTop: 10 }}>
                    <table>
                      <thead>
                        <tr><th>ID</th><th>Name</th><th>Current → Desired</th><th>Autonomy</th><th></th></tr>
                      </thead>
                      <tbody>
                        {boUnits.map((u) => (
                          <tr key={u.id} onClick={() => void openWu(u.id)} style={{ cursor: "pointer" }}>
                            <td>{u.id}</td>
                            <td>{u.name}</td>
                            <td className="muted">{u.current_condition} → {u.desired_condition}</td>
                            <td>{u.autonomy ?? "—"}</td>
                            <td className="muted">view 18 attrs →</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedWu && (
                  <div className="card" style={{ marginTop: 14 }}>
                    <h3>{selectedWu.id} — {selectedWu.name} (L3)</h3>
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                      <div><strong>Current → desired:</strong> {selectedWu.current_condition} → {selectedWu.desired_condition}</div>
                      <div><strong>Trigger:</strong> {selectedWu.trigger}</div>
                      <div><strong>Inputs:</strong> {selectedWu.input.join(", ") || "—"}</div>
                      <div><strong>Authority:</strong> {selectedWu.authority}</div>
                      <div><strong>Acceptance criteria:</strong> {selectedWu.acceptance_criteria.join("; ") || "—"}</div>
                      <div><strong>Evidence required:</strong> {selectedWu.evidence_required.join(", ") || "—"}</div>
                      <div><strong>Verification method:</strong> {selectedWu.verification_method}</div>
                      <div><strong>Failure semantics:</strong> {selectedWu.failure_semantics}</div>
                      <div><strong>Dependencies:</strong> {selectedWu.dependencies.join(", ") || "none"}</div>
                      <div><strong>Provenance:</strong> {selectedWu.provenance.source_type}
                        {selectedWu.provenance.hash_sha256 && <> · sha256 {selectedWu.provenance.hash_sha256.slice(0, 12)}…</>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === "automation-index" && (
        <div>
          {!automationIndex && <Loading />}
          {automationIndex && (
            <>
              <div className="metrics">
                <div className="metric"><div className="n">{automationIndex.L5_count + automationIndex.L6_count}</div><div className="l">L5-L6 (automated)</div></div>
                <div className="metric"><div className="n">{automationIndex.total_hours_current.toFixed(1)}h</div><div className="l">Hours / month, current</div></div>
                <div className="metric"><div className="n">{automationIndex.total_hours_saveable.toFixed(1)}h</div><div className="l">Hours / month, saveable</div></div>
                <div className="metric"><div className="n">{automationIndex.rule_debt_count}</div><div className="l">Rule debt (human spot-check)</div></div>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {([1, 2, 3, 4, 5, 6] as const).map((lvl) => (
                  <span key={lvl} className="badge">L{lvl}: {automationIndex[`L${lvl}_count` as keyof AutomationIndex] as number}</span>
                ))}
                {automationIndex.verdict_missing_count > 0 && (
                  <span className="badge">{automationIndex.verdict_missing_count} missing VERDICT</span>
                )}
              </div>

              {automationIndex.cost_per_verified_unit === null && (
                <Banner kind="info">Cost per verified unit: not available — needs_cost_profile is true, no CostProfile data populated yet. Hours only, no invented $ rate.</Banner>
              )}

              <h3>Bottleneck view</h3>
              {automationIndex.bottleneck_view.length === 0 ? (
                <p className="health">No bottlenecks detected.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Authority</th><th>WU count</th><th>Hours/day</th><th>Bus factor 1</th></tr></thead>
                    <tbody>
                      {automationIndex.bottleneck_view.map((row) => (
                        <tr key={row.wu_ids.join(",")} className={row.bus_factor_1 ? "highlight" : undefined}>
                          <td>{row.authority_redacted}</td>
                          <td>{row.wu_count}</td>
                          <td>{row.hours_per_day.toFixed(2)}</td>
                          <td>{row.bus_factor_1 ? "⚠ yes" : "no"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h3>Work graph</h3>
              <div className="gap-counts">
                <span className="badge">{automationIndex.work_graph_summary.sequence_edges} sequence</span>
                <span className="badge">{automationIndex.work_graph_summary.shared_object_edges} shared object</span>
                <span className="badge">{automationIndex.work_graph_summary.shared_resource_edges} shared resource</span>
                <span className="badge">
                  {automationIndex.work_graph_summary.reciprocal_computed
                    ? `${automationIndex.work_graph_summary.reciprocal_edges} reciprocal`
                    : "reciprocal: not computed"}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
