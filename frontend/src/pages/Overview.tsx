import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { CompanyBanner } from "../components/CompanyBanner";
import { LabelWithInfo } from "../components/InfoTooltip";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import type { EconomicsProjection, Health, Page, WorkUnit } from "../types";
import { Banner, Loading } from "../ui";

type PackHonest = {
  honest_case?: {
    gross_hours: number;
    attributed_hours: number;
    fte: number;
    verdict_l4_plus?: number;
    verdict_inferred?: number;
    cost_inferred?: number;
    coverage?: { units: number; verdict: number; costed: number };
    note?: string;
  };
  inventory?: { total: number };
  work_graph?: { edges: unknown[] };
  function?: string;
};

export default function Overview() {
  const { client, setClientId, reload } = useCompany();
  const health = useApi<Health>("/health");
  const units = useApi<Page<WorkUnit>>(withClient("/work-units/", client?.id));
  const economics = useApi<EconomicsProjection>(withClient("/projections/economics", client?.id));
  const pack = useApi<PackHonest>(
    client?.kind === "catalog" ? withClient("/projections/pack", client.id) : client ? `/census/pack/${client.id}?function=${encodeURIComponent("HR & People Ops")}` : null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function prepareDemo() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const result = await api.post<{
        client_a_id: number;
        catalog_hr_created: number;
        cloned_hr: number;
        census: { units: number; gaps: number; l4_plus: number; note: string };
        note: string;
      }>("/demo/prepare");
      setClientId(result.client_a_id);
      reload();
      setMsg(
        `Demo ready on Client A: ${result.census?.units ?? 12} HR units, ${result.census?.gaps ?? 0} gaps vs sample SOP. ${result.note}`,
      );
      units.reload();
      economics.reload();
      pack.reload();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const h = health.data;
  const count = units.data?.total ?? 0;
  const totals = economics.data?.totals;
  const honest = pack.data?.honest_case;
  const catalog = client?.kind === "catalog";

  return (
    <>
      <h2 data-tour="overview">Work Engineering</h2>
      <p className="lede">
        Converts enterprise intent into work a machine can read, a checker can verify, and an
        organisation can allocate. The Work Unit is the primitive. This is the specification
        layer — execution systems consume it. A census is one company × one function × ~90 days.
      </p>
      <CompanyBanner />
      {health.error && <Banner kind="error">{health.error}</Banner>}
      {err && <Banner kind="error">{err}</Banner>}
      {msg && <Banner kind="ok">{msg}</Banner>}
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

      <section className="card" data-tour="demo-walk">
        <h3>Colleague walkthrough (10 minutes)</h3>
        <ol className="demo-steps">
          <li>Prepare the Client A HR demo (12 onboarding/offboarding units + sample SOP).</li>
          <li>Stay on <strong>Client A</strong> in the company switcher. Catalog is the test lab.</li>
          <li>Work Units: stacked HR inventory. Run census if you paste a different SOP.</li>
          <li>Discovery: declared SOP vs inventory (conformance gap).</li>
          <li>Projections: five views of the same records — inventory, graph, verification, allocation, economics.</li>
          <li>VERDICT: drafts are <em>inferred</em> until you confirm. Hours are not measured FTE until confirmed.</li>
        </ol>
        <div className="toolbar">
          <button className="primary" disabled={busy} onClick={() => void prepareDemo()}>
            {busy ? "Preparing…" : "Prepare Client A HR demo"}
          </button>
          <Link to="/work-units">Work Units</Link>
          <Link to="/projections">Five projections</Link>
          <Link to="/discovery">Discovery / gaps</Link>
        </div>
      </section>

      <p className="hint">
        {catalog
          ? "Catalog is for platform tests. Do not treat mixed functions and industries as one census."
          : `${client?.name ?? "This company"} · HR & People Ops is the V8 J1 wedge: one function, one employer, draft pack.`}
      </p>

      <div className="metrics">
        <div className="metric">
          <div className="n">{count}</div>
          <div className="l">Work Units in {client?.name ?? "this company"}</div>
        </div>
        <div className="metric">
          <div className="n">{honest?.verdict_l4_plus ?? "—"}</div>
          <div className="l">VERDICT L4+ (draft until confirmed)</div>
        </div>
        <div className="metric">
          <div className="n">{totals ? totals.attributed_hours.toFixed(1) : "—"}</div>
          <div className="l">Attributed hours / month</div>
        </div>
        <div className="metric">
          <div className="n">{totals ? totals.fte.toFixed(2) : "—"}</div>
          <div className="l">FTE after attribution (H5)</div>
        </div>
      </div>
      {honest?.note && <p className="hint">{honest.note}</p>}
      {(honest?.verdict_inferred || honest?.cost_inferred) ? (
        <Banner kind="warn">
          {honest.verdict_inferred ?? 0} VERDICT scores and {honest.cost_inferred ?? 0} cost profiles
          are inferred from the contract. Confirm on VERDICT and Economics before treating as
          authoritative.
        </Banner>
      ) : null}

      <dl className="card">
        <dt className="muted">Census (J1)</dt>
        <dd>One company, one function, ~90 days. Output: inventory, graph, VERDICT, economics, conformance gap.</dd>
        <dt className="muted">Five projections (C3)</dt>
        <dd>Inventory, Work Graph, Verification contracts, Allocation, Economics — views of the same records, not a queue.</dd>
        <dt className="muted">Boundary (C4)</dt>
        <dd>Produces a specification. Execution systems consume it via the Spec API. This product does not run the work.</dd>
        <dt className="muted"><LabelWithInfo label="Economics">Honest case (H5)</LabelWithInfo></dt>
        <dd>Cost to do, cost to verify, exceptions, then attribution. The smaller number is the honest one.</dd>
      </dl>
    </>
  );
}
