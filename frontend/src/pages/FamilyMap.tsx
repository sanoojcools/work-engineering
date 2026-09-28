import { Link } from "react-router-dom";
import { InfoTooltip } from "../components/InfoTooltip";
import { DESKS_BY_ID } from "../lib/desks";
import { CROSS_DESK_HANDOFFS } from "../lib/desks/functionGraph";
import { deskHoursSummary } from "../lib/desks/functionHours";
import type { DeskSpec } from "../lib/desks/types";
import { useIsGuest } from "../lib/guestMode";

/** T6 Family map. A two-minute colleague page: six desks, who runs each,
 * stated hours from desks/*.ts, and only the edges already named in
 * functionGraph.ts. Plan 95 / 61.8 stay on Plan. This page does not mint
 * a key and does not sum hours. */

const ROUTE_BY_DESK_ID: Record<string, string> = {
  "offer-desk": "/scout/offer-desk",
  onboarding: "/hr/operations/onboarding",
  offboarding: "/hr/operations/offboarding",
  "vendor-mgmt": "/hr/operations/vendor-mgmt",
  "us-hr": "/hr/operations/us-hr",
  hrbp: "/hr/hrbp",
};

const INDIA_DESK_IDS = ["offer-desk", "onboarding", "offboarding", "vendor-mgmt", "hrbp"] as const;

const STATED_HOURS = Object.fromEntries(deskHoursSummary().map((row) => [row.desk.id, row.raw]));

function DeskRow({ spec, note }: { spec: DeskSpec; note?: string }) {
  return (
    <div className="card" style={{ margin: 0 }} data-testid="family-desk" data-desk={spec.id}>
      <Link to={ROUTE_BY_DESK_ID[spec.id]} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <h3 style={{ margin: "0 0 6px" }}>{spec.name}</h3>
        <p style={{ fontSize: 14, margin: "0 0 6px" }} data-testid="family-desk-who">
          {spec.primarySpoc}
        </p>
        <p style={{ fontSize: 14, margin: 0 }} data-testid="family-desk-hours">
          Stated: {STATED_HOURS[spec.id]}
        </p>
        {note && (
          <p className="hint" style={{ margin: "8px 0 0" }}>
            {note}
          </p>
        )}
      </Link>
    </div>
  );
}

export default function FamilyMap() {
  const isGuest = useIsGuest();

  return (
    <div data-testid="family-map">
      <p className="hint" style={{ marginBottom: 4 }}>
        Trianz P&C · six desks
      </p>
      <h2>How the desks connect</h2>
      <p className="lede">
        Six desks. Who runs each. Hours each desk stated. Only the connections a sitting already named.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>India desks</h3>
        <div className="stack" style={{ gap: 10 }}>
          {INDIA_DESK_IDS.map((id) => (
            <DeskRow
              key={id}
              spec={DESKS_BY_ID[id]}
              note={
                id === "offer-desk"
                  ? "Rashmi also runs US HR — that is a second desk, not a connection from this one."
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }} data-testid="family-us-hr">
        <p className="hint" style={{ marginTop: 0 }}>
          <InfoTooltip
            term="Parallel cluster"
            simple="US HR runs on Job Vite, a different tool than India's Zwayam. It is drawn next to the India desks on purpose — not folded into them, and not given a new connection."
          />{" "}
          Job Vite. Same person as Offer Desk — two desks, not one.
        </p>
        <DeskRow spec={DESKS_BY_ID["us-hr"]} />
      </div>

      <div className="card" style={{ marginBottom: 16 }} data-testid="family-handoffs">
        <h3 style={{ marginTop: 0 }}>
          Named connections{" "}
          <InfoTooltip
            term="Handoff"
            simple="A connection is drawn only when one desk's own sitting names the other desk. Nothing else is added."
          />
        </h3>
        <div className="stack" style={{ gap: 10 }}>
          {CROSS_DESK_HANDOFFS.map((edge) => {
            const from = DESKS_BY_ID[edge.fromDeskId];
            const to = DESKS_BY_ID[edge.toDeskId];
            return (
              <div
                key={`${edge.fromDeskId}->${edge.toDeskId}`}
                className="card"
                style={{ margin: 0 }}
                data-testid="family-handoff"
              >
                <strong>
                  {from.name} → {to.name}
                </strong>
                <p style={{ fontSize: 13, margin: "6px 0 0" }}>{edge.handoff.whatIsPassed}</p>
              </div>
            );
          })}
        </div>
      </div>

      {isGuest && (
        <p className="hint" data-testid="family-guest">
          Looking only.
        </p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link to="/">← Trianz P&C</Link>
        {" · "}
        <Link to="/hr/function-graph">Longer schematic →</Link>
      </p>
    </div>
  );
}
