import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { useApi } from "../hooks";
import { useCompany } from "../company";
import { useIsGuest } from "../lib/guestMode";
import { withClient } from "../lib/withClient";
import { OFFER_DESK_SAMPLE_ROWS } from "../lib/offerDeskData";
import type { GraphProjection } from "../types";

/** WU-OD- is the evidence-pack genome's own code prefix (lib/offerDeskEvidencePack.json,
 * the only place it's used in this codebase) -- filters a tenant's whole Work
 * Graph down to just the Offer Desk sitting's 11 steps, the same idiom
 * OfferDeskGap.tsx uses to filter /discovery/gaps down to three gate kinds. */
function isOfferDeskCode(code: string): boolean {
  return code.startsWith("WU-OD-");
}

export default function OfferDeskWorkGraph() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const { data, loading, error } = useApi<GraphProjection>(
    isGuest ? null : withClient("/projections/work-graph", keyClientId),
  );

  const nodes = (data?.nodes ?? []).filter((n) => isOfferDeskCode(n.code));
  const nodeIds = new Set(nodes.map((n) => n.id));
  // Defensive, not decorative: services/automation_index.py's own bottleneck
  // detector persists real shared_resource edges into this same work_edges
  // table the moment anyone views a genome's Automation Index (all 11
  // evidence-pack units share one authority, Rashmi KN, which is exactly
  // what that detector groups on) -- filtering to edge_type sequence keeps
  // this screen sequence-only by construction, never by luck of what nobody
  // has clicked yet.
  const edges = (data?.edges ?? []).filter(
    (e) => e.edge_type === "sequence" && nodeIds.has(e.source_id) && nodeIds.has(e.target_id),
  );
  const ordered = [...nodes].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · Work Graph · sequence only
      </p>
      <h2>
        Eleven steps, in order{" "}
        <InfoTooltip
          term="Sequence edge"
          simple="B cannot start until A completes. The only edge type this screen shows -- no shared-object, shared-resource, or reciprocal claims here, even if the tenant's data has some."
        />
      </h2>
      <p className="lede">
        The sitting named eleven steps in order. This reads that order back from real dependency edges once a genome
        exists for this tenant — it does not redraw the workbook text as a picture.
      </p>
      <SeatStepper />

      {isGuest ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
            No genome exists for a guest — this is the step order from the sitting, written as a list, not a computed
            graph. No arrows are drawn because none are computed yet.
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {OFFER_DESK_SAMPLE_ROWS.map((r) => (
              <li key={r.name} style={{ marginBottom: 4 }}>{r.name}</li>
            ))}
          </ol>
        </div>
      ) : loading ? (
        <p className="hint">Loading this tenant's Work Graph…</p>
      ) : error ? (
        <div className="banner error">{error}</div>
      ) : nodes.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>No Offer Desk Work Units on this tenant yet — a true empty state.</strong>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
            Talk-only never writes these steps as Work Units (Save talk-only stays at zero saved). Import{" "}
            <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to create the real 11-unit genome
            and come back — this page never draws an arrow that isn't a real edge.
          </p>
        </div>
      ) : (
        <>
          <p className="graph-stats">
            <strong>{nodes.length}</strong> Offer Desk work unit{nodes.length === 1 ? "" : "s"} ·{" "}
            <strong>{edges.length}</strong> sequence edge{edges.length === 1 ? "" : "s"}
            {edges.length !== Math.max(0, nodes.length - 1) && (
              <>
                {" "}
                · <span className="hint">expected {Math.max(0, nodes.length - 1)} for an unbroken chain</span>
              </>
            )}
          </p>
          <div className="stack" style={{ gap: 0 }}>
            {ordered.map((n, i) => {
              const next = ordered[i + 1];
              const hasNext = !!next && edges.some((e) => e.source_id === n.id && e.target_id === next.id);
              return (
                <div key={n.id}>
                  <div
                    className="card"
                    style={{ margin: 0, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}
                  >
                    <div>
                      <strong>{n.code}</strong> · {n.name}
                    </div>
                    <span className="hint">{n.business_object ?? "—"}</span>
                  </div>
                  {next && (
                    <div
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        color: hasNext ? "var(--accent)" : "var(--danger)",
                        padding: "2px 0",
                      }}
                    >
                      {hasNext ? "↓ sequence" : "↓ no edge recorded"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <IoPanes
        given={
          isGuest
            ? "The sitting's own step order, eleven lines."
            : "This tenant's Work Graph, filtered to the Offer Desk sitting's own codes."
        }
        understood="Sequence means B waits for A. Nothing here claims a shared object, a shared resource, or a reciprocal loop."
        processed={
          isGuest
            ? "A list, not a query. No dependency edges exist without an import."
            : "GET /projections/work-graph, filtered client-side to WU-OD- codes and edge_type=sequence."
        }
        output={
          isGuest
            ? "Eleven lines, no arrows."
            : `${edges.length} real sequence edge(s) across ${nodes.length} real work unit(s).`
        }
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/work-graph">Open the full Work Graph →</Link>
        {" · "}
        <Link to="/scout/offer-desk/gap">Show the gap next →</Link>
      </p>
    </>
  );
}
