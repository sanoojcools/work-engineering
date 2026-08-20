import { api, errorMessage } from "../api";
import { useApi } from "../hooks";
import { useState } from "react";
import type { GraphProjection, Page, WorkUnit } from "../types";
import { EDGE_TYPES } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

export default function WorkGraph() {
  const graph = useApi<GraphProjection>("/projections/work-graph");
  const units = useApi<Page<WorkUnit>>("/work-units/");
  const [error, setError] = useState<string | null>(null);

  const byId = new Map((graph.data?.nodes ?? []).map((n) => [n.id, n]));

  return (
    <>
      <h2>Work Graph</h2>
      <p className="lede">
        Dependencies between Work Units: sequence, shared object, shared resource, reciprocal.
        Coupling is specified here; runtime coordination belongs to execution.
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {graph.error && <Banner kind="error">{graph.error}</Banner>}
      {graph.loading ? <Loading /> : (
        <>
          <DataTable
            rows={(graph.data?.edges ?? []).map((e) => ({ ...e }))}
            columns={[
              {
                key: "source_id",
                header: "From",
                render: (e) => byId.get(e.source_id)?.code ?? e.source_id,
              },
              {
                key: "target_id",
                header: "To",
                render: (e) => byId.get(e.target_id)?.code ?? e.target_id,
              },
              { key: "edge_type", header: "Type" },
            ]}
          />
          <ul className="edge-list">
            {(graph.data?.edges ?? []).map((e) => (
              <li key={e.id}>
                {byId.get(e.source_id)?.name ?? e.source_id} → {byId.get(e.target_id)?.name ?? e.target_id}{" "}
                <span className="muted">({e.edge_type})</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <section className="card">
        <h3>Add dependency</h3>
        <Form
          onSubmit={async (event) => {
            const form = event.currentTarget;
            const data = new FormData(form);
            setError(null);
            try {
              await api.post("/work-graph/edges", {
                source_id: Number(data.get("source_id")),
                target_id: Number(data.get("target_id")),
                edge_type: data.get("edge_type"),
              });
              form.reset();
              graph.reload();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label="From">
            <select name="source_id" required>
              <option value="">Select</option>
              {(units.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.code} · {u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <select name="target_id" required>
              <option value="">Select</option>
              {(units.data?.items ?? []).map((u) => (
                <option key={`t${u.id}`} value={u.id}>{u.code} · {u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Edge type">
            <select name="edge_type">{EDGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <button className="primary" type="submit">Add edge</button>
        </Form>
      </section>
    </>
  );
}
