import { api, errorMessage } from "../api";
import { CompanyBanner } from "../components/CompanyBanner";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import { useMemo, useState } from "react";
import type { GraphProjection, Page, WorkUnit } from "../types";
import { EDGE_TYPES } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

type Laid = { id: number; x: number; y: number; code: string; name: string };

function layout(graph: GraphProjection | null): Laid[] {
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  if (nodes.length === 0) return [];
  const incoming = new Map<number, number>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) incoming.set(e.target_id, (incoming.get(e.target_id) ?? 0) + 1);
  const rank = new Map<number, number>();
  const queue = nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (queue.length === 0) queue.push(nodes[0].id);
  for (const id of queue) rank.set(id, 0);
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    adj.set(e.source_id, [...(adj.get(e.source_id) ?? []), e.target_id]);
  }
  const seen = new Set(queue);
  while (queue.length) {
    const id = queue.shift()!;
    for (const nxt of adj.get(id) ?? []) {
      rank.set(nxt, Math.max(rank.get(nxt) ?? 0, (rank.get(id) ?? 0) + 1));
      if (!seen.has(nxt)) {
        seen.add(nxt);
        queue.push(nxt);
      }
    }
  }
  for (const n of nodes) if (!rank.has(n.id)) rank.set(n.id, 0);
  const cols = new Map<number, Laid[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = cols.get(r) ?? [];
    list.push({ id: n.id, x: 40 + r * 220, y: 0, code: n.code, name: n.name });
    cols.set(r, list);
  }
  const laid: Laid[] = [];
  for (const list of cols.values()) {
    list.forEach((node, i) => {
      node.y = 28 + i * 72;
      laid.push(node);
    });
  }
  return laid;
}

export default function WorkGraph() {
  const { client } = useCompany();
  const graph = useApi<GraphProjection>(withClient("/projections/work-graph", client?.id));
  const units = useApi<Page<WorkUnit>>(withClient("/work-units/", client?.id));
  const [error, setError] = useState<string | null>(null);
  const byId = new Map((graph.data?.nodes ?? []).map((n) => [n.id, n]));
  const nodes = useMemo(() => layout(graph.data), [graph.data]);
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const width = Math.max(640, ...nodes.map((n) => n.x + 200), 640);
  const height = Math.max(280, ...nodes.map((n) => n.y + 60), 280);

  return (
    <>
      <h2>Work Graph</h2>
      <p className="lede">
        Dependencies between Work Units: sequence, shared object, shared resource, reciprocal.
        Coupling is specified here; runtime coordination belongs to execution.
      </p>
      <CompanyBanner />
      {error && <Banner kind="error">{error}</Banner>}
      {graph.error && <Banner kind="error">{graph.error}</Banner>}
      {graph.loading ? <Loading /> : (
        <>
          <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Work Graph">
            {(graph.data?.edges ?? []).map((e) => {
              const a = pos.get(e.source_id);
              const b = pos.get(e.target_id);
              if (!a || !b) return null;
              const x1 = a.x + 160;
              const y1 = a.y + 18;
              const x2 = b.x;
              const y2 = b.y + 18;
              const mx = (x1 + x2) / 2;
              return (
                <g key={e.id}>
                  <path className="graph-edge" d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} />
                  <text x={mx} y={(y1 + y2) / 2 - 6} fontSize="10" fill="#6b6860" textAnchor="middle">
                    {e.edge_type.replace("_", " ")}
                  </text>
                </g>
              );
            })}
            {nodes.map((n) => (
              <g key={n.id} className="graph-node">
                <rect x={n.x} y={n.y} width="168" height="44" rx="2" />
                <text x={n.x + 8} y={n.y + 18} fontSize="11" fontWeight="600">{n.code}</text>
                <text x={n.x + 8} y={n.y + 34} fontSize="10" fill="#6b6860">
                  {n.name.slice(0, 28)}
                </text>
              </g>
            ))}
          </svg>
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
