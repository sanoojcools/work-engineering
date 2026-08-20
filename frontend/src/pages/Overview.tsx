import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useApi } from "../hooks";
import type { EconomicsProjection, Health, Page, WorkUnit } from "../types";
import { Banner, Loading } from "../ui";

export default function Overview() {
  const health = useApi<Health>("/health");
  const units = useApi<Page<WorkUnit>>("/work-units/");
  const economics = useApi<EconomicsProjection>("/projections/economics");
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [seedErr, setSeedErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function seed() {
    setBusy(true);
    setSeedErr(null);
    setSeedMsg(null);
    try {
      const result = await api.post<{ status: string; work_units: number }>("/seed");
      setSeedMsg(`Census loaded · ${result.work_units} work units`);
      units.reload();
      economics.reload();
    } catch (err) {
      setSeedErr(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const h = health.data;
  const count = units.data?.total ?? 0;
  const totals = economics.data?.totals;

  return (
    <>
      <h2 data-tour="overview">Work Engineering</h2>
      <p className="lede">
        Converts enterprise intent into work a machine can read, a checker can verify, and an
        organisation can allocate. The Work Unit is the primitive. This UI is the specification
        layer — execution systems consume it.
      </p>
      {health.error && <Banner kind="error">{health.error}</Banner>}
      {seedErr && <Banner kind="error">{seedErr}</Banner>}
      {seedMsg && <Banner kind="ok">{seedMsg}</Banner>}
      {health.loading ? (
        <Loading />
      ) : (
        <p className="health">
          API:{" "}
          <strong>
            {h ? `${h.status} · v${h.version} · db ${h.db_ready ? "ready" : "not connected"}` : "unreachable"}
          </strong>
        </p>
      )}
      <div className="metrics">
        <div className="metric">
          <div className="n">{count}</div>
          <div className="l">Work Units</div>
        </div>
        <div className="metric">
          <div className="n">{totals ? totals.gross_hours.toFixed(1) : "—"}</div>
          <div className="l">Gross hours / month</div>
        </div>
        <div className="metric">
          <div className="n">{totals ? totals.attributed_hours.toFixed(1) : "—"}</div>
          <div className="l">Attributed hours</div>
        </div>
        <div className="metric">
          <div className="n">{totals ? totals.fte.toFixed(2) : "—"}</div>
          <div className="l">FTE (discipline 4)</div>
        </div>
      </div>
      <div className="toolbar">
        <button className="primary" disabled={busy} onClick={() => void seed()}>
          {busy ? "Seeding…" : "Load order-to-cash census"}
        </button>
        <Link to="/work-units">Open inventory</Link>
        <Link to="/projections">Five projections</Link>
      </div>
      <dl className="card">
        <dt className="muted">Container</dt>
        <dd>Ontology + Enterprise Graph</dd>
        <dt className="muted">Five projections</dt>
        <dd>Inventory, Work Graph, Verification contracts, Allocation, Economics</dd>
        <dt className="muted">Boundary</dt>
        <dd>Produces a specification. Execution systems consume it via the Spec API.</dd>
      </dl>
    </>
  );
}
