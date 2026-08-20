import { LabelWithInfo } from "../components/InfoTooltip";
import { useApi } from "../hooks";
import type { AllocationItem, EconomicsProjection, GraphProjection, WorkUnit } from "../types";
import { Banner, DataTable, Loading } from "../ui";

export default function Projections() {
  const inventory = useApi<{ total: number; items: WorkUnit[] }>("/projections/inventory");
  const graph = useApi<GraphProjection>("/projections/work-graph");
  const verification = useApi<{ items: Array<Record<string, string | number>> }>("/projections/verification");
  const allocation = useApi<{ items: AllocationItem[] }>("/projections/allocation");
  const economics = useApi<EconomicsProjection>("/projections/economics");

  const err = inventory.error || graph.error || verification.error || allocation.error || economics.error;
  const onb = (inventory.data?.items ?? []).find((u) => u.code === "WU-ONB-04");
  const onbAlloc = (allocation.data?.items ?? []).find((u) => u.code === "WU-ONB-04");

  return (
    <>
      <h2 data-tour="projections">Projections — 5 views of the same truth</h2>
      <p className="lede">
        Five outputs, one record. These views are not a queue of artefacts — they are projections of
        the Work Unit inventory.
      </p>
      {err && <Banner kind="error">{err}</Banner>}

      <div className="view-grid">
        <section className="card">
          <h3><LabelWithInfo label="Work Unit">Inventory</LabelWithInfo></h3>
          <p className="muted">All {inventory.data?.total ?? "—"} Work Units with L-level. HR units such as WU-ONB-04 appear here.</p>
        </section>
        <section className="card">
          <h3>Work Graph</h3>
          <p className="muted">Dependencies between units. {graph.data?.edges.length ?? "—"} edges.</p>
        </section>
        <section className="card">
          <h3><LabelWithInfo label="Verification Run">Verification</LabelWithInfo></h3>
          <p className="muted">0/5 runs = cannot promote. After bulk create, the contract still shows here.</p>
        </section>
        <section className="card">
          <h3><LabelWithInfo label="Allocation">Allocation</LabelWithInfo></h3>
          <p className="muted">make = human, agent = robot + check, automate = fully robot, buy = external.</p>
        </section>
        <section className="card">
          <h3><LabelWithInfo label="Economics">Economics</LabelWithInfo></h3>
          <p className="muted">FTE math: do-time × volume, then verify, exceptions, and attribution.</p>
        </section>
      </div>

      {onb && (
        <section className="card">
          <h3>WU-ONB-04 in this view</h3>
          <p className="muted">
            {onb.code} · {onb.owner || "HR Ops SPOC"} · {onb.actor_type} · authorised L{onb.autonomy_level}
            {onbAlloc ? ` · VERDICT ${onbAlloc.recommended_level ?? "—"} · ${onbAlloc.allocation}` : ""}
          </p>
          <p className="hint">
            Authorised level is what you promoted. VERDICT is the cap. The gap is remaining potential.
          </p>
        </section>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="n">{inventory.data?.total ?? "—"}</div>
          <div className="l">Inventory</div>
        </div>
        <div className="metric">
          <div className="n">{graph.data?.edges.length ?? "—"}</div>
          <div className="l">Work Graph edges</div>
        </div>
        <div className="metric">
          <div className="n">{allocation.data?.items.length ?? "—"}</div>
          <div className="l">Allocation rows</div>
        </div>
        <div className="metric">
          <div className="n">{economics.data ? economics.data.totals.fte.toFixed(2) : "—"}</div>
          <div className="l">Attributed FTE</div>
        </div>
      </div>

      <section className="card">
        <h3>Inventory</h3>
        {inventory.loading ? <Loading /> : (
          <DataTable
            rows={inventory.data?.items ?? []}
            columns={[
              { key: "code", header: "Code" },
              { key: "name", header: "Name" },
              { key: "status", header: "Status" },
              { key: "autonomy_level", header: "L" },
              { key: "machine_readable", header: "Readable", render: (r) => (r.machine_readable ? "yes" : "no") },
            ]}
          />
        )}
      </section>

      <section className="card">
        <h3>Work Graph</h3>
        {graph.loading ? <Loading /> : (
          <DataTable
            rows={graph.data?.edges ?? []}
            columns={[
              { key: "source_id", header: "From id" },
              { key: "target_id", header: "To id" },
              { key: "edge_type", header: "Type" },
            ]}
          />
        )}
      </section>

      <section className="card">
        <h3>Verification contracts</h3>
        {verification.loading ? <Loading /> : (
          <DataTable
            rows={(verification.data?.items ?? []).map((row, i) => ({ id: Number(row.id ?? i), ...row }))}
            columns={[
              { key: "code", header: "Code" },
              { key: "verification_method", header: "Method" },
              { key: "acceptance_criteria", header: "Acceptance" },
              { key: "evidence_required", header: "Evidence" },
            ]}
          />
        )}
      </section>

      <section className="card">
        <h3>Allocation</h3>
        {allocation.loading ? <Loading /> : (
          <DataTable
            rows={allocation.data?.items ?? []}
            columns={[
              { key: "code", header: "Code" },
              { key: "owner", header: "Owner (accountability)" },
              { key: "actor_type", header: "Actor (execution)" },
              { key: "autonomy_level", header: "Authorised L" },
              { key: "recommended_level", header: "VERDICT L" },
              { key: "allocation", header: "Make/agent/automate/buy" },
              { key: "gates", header: "Gates" },
            ]}
          />
        )}
      </section>

      <section className="card">
        <h3>Economics</h3>
        {economics.loading ? <Loading /> : (
          <DataTable
            rows={(economics.data?.items ?? []).map((row, i) => ({
              id: Number(row.work_unit_id ?? i),
              ...row,
            }))}
            columns={[
              { key: "code", header: "Code" },
              { key: "gross_hours", header: "Gross h" },
              { key: "attributed_hours", header: "Attributed h" },
              { key: "fte", header: "FTE" },
            ]}
          />
        )}
      </section>
    </>
  );
}
