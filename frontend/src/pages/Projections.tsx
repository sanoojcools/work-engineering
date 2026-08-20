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

  return (
    <>
      <h2>Projections</h2>
      <p className="lede">
        Five outputs, one record. These views are not a queue of artefacts — they are projections of
        the Work Unit inventory.
      </p>
      {err && <Banner kind="error">{err}</Banner>}

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
