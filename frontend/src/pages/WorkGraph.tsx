import { api, errorMessage } from "../api";
import { CompanyBanner } from "../components/CompanyBanner";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { GraphProjection, Page, WorkUnit } from "../types";
import { EDGE_TYPES } from "../types";
import { Banner, DataTable, Empty, Field, Form, Loading } from "../ui";

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

/** There is no "process family" column on a Work Unit — business_object_type
 * is what the unit acts *on* (every HR unit here shares "Employee"), not
 * which function it belongs to. The codebase already leans on the code
 * prefix for that (services/tenants.py's FUNCTION_PREFIXES, HR_CLONE_PREFIXES)
 * so this reads the same signal client-side rather than inventing a second
 * taxonomy: strip the trailing "-<segment with a digit>" (handles "-04" and
 * "-02B" alike) and use what's left, e.g. "WU-ONB-04" -> "ONB". */
function groupOf(code: string): string {
  const stripped = code.replace(/-[A-Za-z]*\d[A-Za-z0-9]*$/, "");
  return stripped.replace(/^WU-/, "") || code;
}

const EDGE_MEANING: Record<string, string> = {
  sequence: "B cannot start until A completes",
  shared_object: "both touch the same business object — contention risk",
  shared_resource: "both need the same actor or capability",
  reciprocal: "mutual outputs — an iteration protocol, not a one-way order",
};

/** Categorical identity color, never line style, carries "which group" — see
 * the dataviz skill's color-formula.md. A node-link diagram keeps every
 * category visible at once (closer to a scatterplot's all-pairs case than a
 * sequential legend), so only the first three slots are validated safe
 * together; a fourth+ group folds into a neutral "Other" rather than adding
 * a hue the CVD/normal-vision checks don't clear. */
const GROUP_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];
const OTHER_COLOR = "#928e84";

/** Edge type is a second, independent channel from node-group color, encoded
 * primarily by line style + arrowheads (never color alone — the palette's
 * accessibility rule) with color as reinforcement. sequence is the only
 * directional one (an order), so it is the only one with a single arrowhead;
 * reciprocal is mutual, so it gets both ends. */
const EDGE_STYLE: Record<string, { color: string; dash: string | undefined; marker: "one" | "both" | "none" }> = {
  sequence: { color: "var(--accent)", dash: undefined, marker: "one" },
  shared_object: { color: "var(--warn)", dash: "7 4", marker: "none" },
  shared_resource: { color: "#4a3aa7", dash: "2 3", marker: "none" },
  reciprocal: { color: "var(--danger)", dash: "6 3 1 3", marker: "both" },
};

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;

export default function WorkGraph() {
  const { client } = useCompany();
  const graph = useApi<GraphProjection>(withClient("/projections/work-graph", client?.id));
  const units = useApi<Page<WorkUnit>>(withClient("/work-units/", client?.id));
  const [error, setError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const byId = new Map((graph.data?.nodes ?? []).map((n) => [n.id, n]));
  const nodes = useMemo(() => layout(graph.data), [graph.data]);
  const pos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const width = Math.max(640, ...nodes.map((n) => n.x + 200), 640);
  const height = Math.max(280, ...nodes.map((n) => n.y + 60), 280);

  const degree = useMemo(() => {
    const d = new Map<number, number>();
    for (const e of graph.data?.edges ?? []) {
      d.set(e.source_id, (d.get(e.source_id) ?? 0) + 1);
      d.set(e.target_id, (d.get(e.target_id) ?? 0) + 1);
    }
    return d;
  }, [graph.data]);

  const groupColor = useMemo(() => {
    const order: string[] = [];
    for (const n of graph.data?.nodes ?? []) {
      const g = groupOf(n.code);
      if (!order.includes(g)) order.push(g);
    }
    const map = new Map<string, string>();
    order.forEach((g, i) => map.set(g, i < GROUP_COLORS.length ? GROUP_COLORS[i] : OTHER_COLOR));
    return map;
  }, [graph.data]);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of graph.data?.nodes ?? []) {
      const g = groupOf(n.code);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return counts;
  }, [graph.data]);

  // For the legend only: groups past the third all render in the same
  // OTHER_COLOR (see groupColor above), so listing each by name next to an
  // identical gray swatch reads as "these are the same group" — they are
  // not. Collapse them into one summed "Other" chip; nodes still show their
  // real function name on hover and in the detail panel either way.
  const legendGroups = useMemo(() => {
    const order = Array.from(groupColor.keys());
    const named = order.slice(0, GROUP_COLORS.length).map((g) => ({
      label: g,
      count: groupCounts.get(g) ?? 0,
      color: groupColor.get(g) ?? OTHER_COLOR,
    }));
    const rest = order.slice(GROUP_COLORS.length);
    if (rest.length === 0) return named;
    const otherCount = rest.reduce((sum, g) => sum + (groupCounts.get(g) ?? 0), 0);
    return [...named, { label: `Other (${rest.join(", ")})`, count: otherCount, color: OTHER_COLOR }];
  }, [groupColor, groupCounts]);

  const edgeTypesPresent = useMemo(() => {
    const present = new Set((graph.data?.edges ?? []).map((e) => e.edge_type));
    return EDGE_TYPES.filter((t) => present.has(t));
  }, [graph.data]);

  const neighbors = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const e of graph.data?.edges ?? []) {
      if (!map.has(e.source_id)) map.set(e.source_id, new Set());
      if (!map.has(e.target_id)) map.set(e.target_id, new Set());
      map.get(e.source_id)!.add(e.target_id);
      map.get(e.target_id)!.add(e.source_id);
    }
    return map;
  }, [graph.data]);

  const focusId = hoverId ?? selectedId;
  const focusNeighbors = focusId !== null ? neighbors.get(focusId) : null;
  const busiest = useMemo(() => {
    let best: { id: number; code: string; n: number } | null = null;
    for (const n of graph.data?.nodes ?? []) {
      const d = degree.get(n.id) ?? 0;
      if (!best || d > best.n) best = { id: n.id, code: n.code, n: d };
    }
    return best;
  }, [graph.data, degree]);

  const selectedNode = selectedId !== null ? byId.get(selectedId) : null;
  const selectedNeighborCodes = selectedId !== null
    ? Array.from(neighbors.get(selectedId) ?? []).map((id) => byId.get(id)?.code ?? String(id)).sort()
    : [];

  function zoomBy(factor: number, cx?: number, cy?: number) {
    setView((v) => {
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
      if (cx === undefined || cy === undefined) return { ...v, zoom: next };
      // Keep the point under the cursor fixed while the scale changes.
      const scaleRatio = next / v.zoom;
      return { zoom: next, x: cx - (cx - v.x) * scaleRatio, y: cy - (cy - v.y) * scaleRatio };
    });
  }

  // React's synthetic onWheel is always registered passive, so
  // event.preventDefault() there throws ("Unable to preventDefault inside
  // passive event listener invocation") and silently no-ops — the page
  // scrolls out from under the graph while it also tries to zoom. Only a
  // real addEventListener with { passive: false } can actually stop it.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".graph-node")) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, viewX: view.x, viewY: view.y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setView((v) => ({
      ...v,
      x: drag.viewX + (event.clientX - drag.startX),
      y: drag.viewY + (event.clientY - drag.startY),
    }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

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
      {graph.loading ? <Loading /> : nodes.length === 0 ? (
        <Empty
          title="No dependencies recorded yet"
          hint="Add one below once this company has at least two Work Units, or import a genome with a dependencies[] field."
        />
      ) : (
        <>
          <p className="graph-stats">
            <strong>{nodes.length}</strong> work units · <strong>{graph.data?.edges.length ?? 0}</strong> edges ·{" "}
            <strong>{groupCounts.size}</strong> function{groupCounts.size === 1 ? "" : "s"}
            {busiest && busiest.n > 0 && (
              <> · busiest: <strong>{busiest.code}</strong> ({busiest.n} edge{busiest.n === 1 ? "" : "s"})</>
            )}
          </p>

          <div className="graph-legend">
            <div className="graph-legend-group">
              {legendGroups.map(({ label, count, color }) => (
                <span key={label} className="graph-legend-chip">
                  <i style={{ background: color }} />
                  {label} ({count})
                </span>
              ))}
            </div>
            <div className="graph-legend-group">
              {edgeTypesPresent.map((t) => {
                const style = EDGE_STYLE[t];
                return (
                  <span key={t} className="graph-legend-chip" title={EDGE_MEANING[t]}>
                    <svg width="22" height="10" aria-hidden="true">
                      <line
                        x1="1" y1="5" x2="21" y2="5"
                        stroke={style.color}
                        strokeWidth="2"
                        strokeDasharray={style.dash}
                      />
                    </svg>
                    {t.replace("_", " ")}
                  </span>
                );
              })}
            </div>
            {(view.zoom !== 1 || view.x !== 0 || view.y !== 0) && (
              <button
                type="button"
                className="graph-reset"
                onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
              >
                Reset view
              </button>
            )}
          </div>

          <div
            ref={canvasRef}
            className="graph-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={(event) => {
              if (!(event.target as HTMLElement).closest(".graph-node")) setSelectedId(null);
            }}
          >
            <div className="graph-zoom-controls">
              <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
              <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
            </div>
            <svg
              className="graph-svg"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Work Graph"
              style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
            >
              <defs>
                <marker id="wg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
                </marker>
                <marker id="wg-arrow-danger" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--danger)" />
                </marker>
              </defs>
              <g transform={`translate(${view.x}, ${view.y}) scale(${view.zoom})`}>
                {(graph.data?.edges ?? []).map((e) => {
                  const a = pos.get(e.source_id);
                  const b = pos.get(e.target_id);
                  if (!a || !b) return null;
                  const x1 = a.x + 160;
                  const y1 = a.y + 18;
                  const x2 = b.x;
                  const y2 = b.y + 18;
                  const mx = (x1 + x2) / 2;
                  const style = EDGE_STYLE[e.edge_type] ?? EDGE_STYLE.sequence;
                  const dimmed = focusId !== null && e.source_id !== focusId && e.target_id !== focusId;
                  const emphasized = focusId !== null && (e.source_id === focusId || e.target_id === focusId);
                  const source = byId.get(e.source_id);
                  const target = byId.get(e.target_id);
                  return (
                    <g key={e.id} className={dimmed ? "graph-edge-dim" : undefined}>
                      <path
                        className="graph-edge"
                        d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                        stroke={style.color}
                        strokeDasharray={style.dash}
                        strokeWidth={emphasized ? 2.6 : 1.6}
                        markerEnd={style.marker !== "none" ? `url(#${e.edge_type === "reciprocal" ? "wg-arrow-danger" : "wg-arrow"})` : undefined}
                        markerStart={style.marker === "both" ? "url(#wg-arrow-danger)" : undefined}
                      />
                      <title>
                        {(source?.code ?? e.source_id)} → {(target?.code ?? e.target_id)}: {e.edge_type.replace("_", " ")}
                        {e.reason ? ` — ${e.reason}` : ""}
                      </title>
                    </g>
                  );
                })}
                {nodes.map((n) => {
                  const meta = byId.get(n.id);
                  const g = groupOf(n.code);
                  const color = groupColor.get(g) ?? OTHER_COLOR;
                  const d = degree.get(n.id) ?? 0;
                  const w = 168 + Math.min(d, 6) * 3;
                  const dimmed = focusId !== null && n.id !== focusId && !focusNeighbors?.has(n.id);
                  const isFocus = n.id === focusId;
                  return (
                    <g
                      key={n.id}
                      className={`graph-node${dimmed ? " graph-node-dim" : ""}${isFocus ? " graph-node-focus" : ""}`}
                      onMouseEnter={() => setHoverId(n.id)}
                      onMouseLeave={() => setHoverId(null)}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId((cur) => (cur === n.id ? null : n.id));
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <rect x={n.x} y={n.y} width={w} height="44" rx="2" style={{ fill: color, fillOpacity: 0.1, stroke: color }} strokeWidth={isFocus ? 2 : 1.2} />
                      <rect x={n.x} y={n.y} width="4" height="44" style={{ fill: color }} />
                      <text x={n.x + 12} y={n.y + 18} fontSize="11" fontWeight="600" fill="var(--ink)">{n.code}</text>
                      <text x={n.x + 12} y={n.y + 34} fontSize="10" fill="var(--muted)">
                        {n.name.slice(0, 28)}
                      </text>
                      <title>
                        {n.code} — {n.name}
                        {meta?.business_object ? `\nBusiness object: ${meta.business_object}` : ""}
                        {meta?.owner ? `\nOwner: ${meta.owner}` : ""}
                        {`\n${d} connection${d === 1 ? "" : "s"}`}
                      </title>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {selectedNode && (
            <section className="card graph-detail">
              <div className="graph-detail-head">
                <div>
                  <strong>{selectedNode.code}</strong> · {selectedNode.name}
                </div>
                <button type="button" className="link-btn" onClick={() => setSelectedId(null)}>Close</button>
              </div>
              <dl className="story-fields graph-detail-grid">
                <dt>Function</dt><dd>{groupOf(selectedNode.code)}</dd>
                <dt>Business object</dt><dd>{selectedNode.business_object ?? "—"}</dd>
                <dt>Owner</dt><dd>{selectedNode.owner || "—"}</dd>
                <dt>Autonomy level</dt><dd>L{selectedNode.autonomy_level}</dd>
                <dt>Verification method</dt><dd>{selectedNode.verification_method.replace(/_/g, " ")}</dd>
                <dt>Connections</dt>
                <dd>
                  {selectedNeighborCodes.length === 0 ? "none" : selectedNeighborCodes.join(", ")}
                </dd>
              </dl>
            </section>
          )}

          <DataTable
            rows={(graph.data?.edges ?? []).map((e) => ({ ...e }))}
            onRowClick={(e) => setSelectedId((cur) => (cur === e.source_id ? null : e.source_id))}
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
              { key: "edge_type", header: "Type", render: (e) => e.edge_type.replace("_", " ") },
              { key: "reason", header: "Reason", render: (e) => e.reason || "—" },
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
