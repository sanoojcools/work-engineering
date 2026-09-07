import { Link } from "react-router-dom";
import { InfoTooltip } from "../components/InfoTooltip";
import { IoPanes } from "../components/IoPanes";
import { DESKS_BY_ID } from "../lib/desks";
import { CROSS_DESK_HANDOFFS } from "../lib/desks/functionGraph";
import { buildFamilyGenomePayload } from "../lib/desks/familyGenome";
import type { DeskSpec } from "../lib/desks/types";
import { useIsGuest } from "../lib/guestMode";

/** HR-FAMILY v0, task D (the stitch): one node per desk, sequence edges
 * read straight off each desk's own step list, and HANDOFF edges only
 * where a sheet's own handoff map names them. This is a declared/sitting
 * schematic built from desks/*.xlsx, not a live read of the real backend
 * Work Graph (WorkGraph.tsx) -- none of the five new desks have ever been
 * imported as a genome, so there is no observed data to read here for
 * them. Guest and signed-in see the identical page for that reason: there
 * is nothing tenant-specific to gate. */

const ROUTE_BY_DESK_ID: Record<string, string> = {
  "offer-desk": "/scout/offer-desk",
  onboarding: "/hr/operations/onboarding",
  offboarding: "/hr/operations/offboarding",
  "vendor-mgmt": "/hr/operations/vendor-mgmt",
  "us-hr": "/hr/operations/us-hr",
  hrbp: "/hr/hrbp",
};

function DeskNode({ spec, note }: { spec: DeskSpec; note?: string }) {
  const chain = spec.steps.map((s) => s.id).join(" → ");
  return (
    <Link to={ROUTE_BY_DESK_ID[spec.id]} className="card" style={{ margin: 0, textDecoration: "none", color: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{spec.name}</h3>
        <span className={`banner ${spec.status === "finalized" ? "ok" : "warn"}`} style={{ padding: "1px 6px", fontSize: 11 }}>
          {spec.status === "finalized" ? "finalized" : "needs follow-up"}
        </span>
      </div>
      <p className="hint" style={{ margin: "4px 0" }}>SPOC: {spec.primarySpoc}</p>
      <p style={{ fontSize: 12, margin: "4px 0", wordBreak: "break-word" }}>
        <InfoTooltip
          term="Sequence"
          simple="B cannot start until A completes, in the order the sitting itself lists the steps."
        />{" "}
        {chain}
      </p>
      {note && <p className="hint" style={{ margin: "4px 0 0", fontStyle: "italic" }}>{note}</p>}
    </Link>
  );
}

const familyGenome = buildFamilyGenomePayload();

export default function HrFunctionGraph() {
  const isGuest = useIsGuest();
  const indiaDeskIds = ["offer-desk", "onboarding", "offboarding", "vendor-mgmt", "hrbp"];

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        HR function · declared schematic, six real sittings
      </p>
      <h2>
        HR function graph{" "}
        <InfoTooltip
          term="Function graph"
          simple="One node per desk. Sequence inside a desk is that desk's own step order. A handoff arrow between two desks only exists where one desk's own sheet names the other by name."
          technical="Client-side only, built from lib/desks/*.ts. Not a read of GraphProjection (WorkGraph.tsx) -- none of these five new desks has a genome, so there is no observed edge to read for them."
        />
      </h2>
      <p className="lede">
        Six real Time & Motion sittings, stitched into one picture. Every arrow below is either a sequence read
        straight off a desk's own step list, or a handoff a sheet names by name — nothing observed, nothing
        invented. Guest and signed-in see the same static schematic; signed-in also sees a section reading the real
        family-genome payload below it.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>India HR Ops cluster</h3>
        <p className="hint" style={{ marginTop: 0 }}>Zwayam-sourced hires. Offer Desk, Onboarding, Offboarding, Vendor Mgmt, and HRBP all sit here.</p>
        <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {indiaDeskIds.map((id) => (
            <DeskNode
              key={id}
              spec={DESKS_BY_ID[id]}
              note={id === "offer-desk" ? "SPOC also runs US HR — see the parallel cluster below." : undefined}
            />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          US HR — parallel cluster{" "}
          <InfoTooltip
            term="Parallel cluster"
            simple="US HR runs on Job Vite, a different recruitment tool than India's Zwayam, with its own SPOC workflow. It is drawn separately on purpose, not folded into the India cluster."
          />
        </h3>
        <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <DeskNode spec={DESKS_BY_ID["us-hr"]} note="Same SPOC as Offer Desk, above — a shared person, not a handoff edge." />
        </div>
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          Rashmi KN is the real, named SPOC on both Offer Desk (12 May 2026 sitting) and US HR (14 May 2026
          sitting). That is one person holding two desks, not one desk duplicated — the two are never merged into a
          single node, and no sequence or handoff line is drawn between them for it.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Handoff edges named in the sheets{" "}
          <InfoTooltip
            term="Handoff edge"
            simple="A cross-desk arrow drawn only when one desk's own sheet names the other desk (or its SPOC) as the recipient or sender of something real."
          />
        </h3>
        <div className="stack" style={{ gap: 10 }}>
          {CROSS_DESK_HANDOFFS.map((edge, i) => {
            const from = DESKS_BY_ID[edge.fromDeskId];
            const to = DESKS_BY_ID[edge.toDeskId];
            return (
              <div className="card" key={i} style={{ margin: 0 }}>
                <strong>
                  {from.name} → {to.name}
                </strong>
                <p style={{ fontSize: 13, margin: "6px 0" }}>
                  "{edge.handoff.whatIsPassed}" — {edge.handoff.format}, {edge.handoff.trigger}
                </p>
                <p className="hint" style={{ margin: 0 }}>
                  Source: {edge.citedFrom} ({edge.handoff.from} → {edge.handoff.to}).
                </p>
              </div>
            );
          })}
        </div>
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          Vendor Mgmt → Offer Desk is drawn one-way: Vendor Mgmt's own sheet directly names "Rashmi KN (Offer Desk)"
          as the recipient of a contractor-conversion handoff. Offer Desk's own sheet separately names an "Asset
          vendor" for contractor offer letters — a real line, but not unambiguously the same party as the Vendor
          Mgmt desk, so it is not drawn as a second edge here rather than guessed into one.
        </p>
      </div>

      <p className="hint" style={{ marginBottom: 16 }}>
        Refused on this graph, on purpose: no edge type beyond sequence and handoff (no shared-object, shared-
        resource, or reciprocal claims — those belong to the real Work Graph, not this sheet-derived schematic), and
        no handoff invented past the three named above.
      </p>

      {!isGuest && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>
            Read from the family genome{" "}
            <InfoTooltip
              term="This genome"
              simple="Not a second, independently hand-maintained picture -- the same buildFamilyGenomePayload() object the family-genome import screen POSTs, read here instead of re-derived."
            />
          </h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Everything above this line is the static sheet schematic, unchanged. This section instead reads the
            actual genome payload: {familyGenome.payload.work_units.length} Work Units across{" "}
            {Object.keys(familyGenome.unitsByDesk).length} desks, {familyGenome.crossDeskEdges.length} cross-desk
            dependency edges (the same three handoffs above, wired as real <code>WU-*</code> code pairs, not desk
            names):
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {familyGenome.crossDeskEdges.map((e) => (
              <li key={`${e.fromCode}-${e.toCode}`}>
                <code>{e.fromCode}</code> → <code>{e.toCode}</code>
              </li>
            ))}
          </ul>
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            This is still built client-side from <code>lib/desks/*.ts</code>, same as the rest of this page — the
            real GQS score for this exact payload only exists once it is actually posted.{" "}
            <Link to="/hr/family-genome">Import family (declared) →</Link>
          </p>
        </div>
      )}

      <IoPanes
        given="Six desks' own step lists and handoff maps (desks/*.xlsx)."
        understood="A sequence arrow means the sitting itself lists B after A. A handoff arrow means one sheet names the other desk or its SPOC by name — not an inference from job titles."
        processed="Rendered client-side from lib/desks/*.ts. No backend call, no genome import, no fabricated observed edge."
        output={`${Object.keys(DESKS_BY_ID).length} desk nodes, ${CROSS_DESK_HANDOFFS.length} named cross-desk handoff edges.`}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/hr/operations">← HR operations</Link>
        {" · "}
        <Link to="/hr/hrbp">HRBP →</Link>
        {" · "}
        <Link to="/scout/offer-desk/work-graph">Offer Desk's own real Work Graph →</Link>
      </p>
    </>
  );
}
