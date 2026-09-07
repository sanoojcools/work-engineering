import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";

const DESK_CARDS = [
  { to: "/scout/offer-desk", name: "Offer Desk", hint: "Live · Rashmi · 3 cities" },
  { to: "/hr/operations/onboarding", name: "Onboarding", hint: "Finalized sitting · Prerana / Sasikala / Thamizh" },
  { to: "/hr/operations/offboarding", name: "Offboarding", hint: "Finalized sitting · Sasikala" },
  { to: "/hr/operations/vendor-mgmt", name: "Vendor Mgmt", hint: "Needs follow-up · Reshma V" },
  { to: "/hr/operations/us-hr", name: "US HR", hint: "Needs follow-up · Rashmi KN, parallel cluster" },
];

export default function HrOps() {
  return (
    <>
      <h2>HR operations</h2>
      <p className="lede">Desks that run after a hire is decided and before the person lands.</p>
      <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {DESK_CARDS.map((d) => (
          <Link key={d.to} to={d.to} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{d.name}</h3>
            <p className="hint">{d.hint}</p>
          </Link>
        ))}
      </div>
      <IoPanes
        given="CHRO map chose HR operations."
        understood="Five real sittings, not one. Offer Desk, Onboarding, and Offboarding are finalized; Vendor Mgmt and US HR still need follow-up documentation per the founder's own email."
        processed="Each desk keeps its own SPOC, its own step list, its own hours — we do not fold SPOC work into Offer Desk, and we do not clone Offer Desk's page five times."
        output="Five desks open. Same underlying DeskSpec shape, five different real sittings."
      />
      <p style={{ marginTop: 20 }}>
        <Link to="/hr/function-graph">See how these five desks hand off to each other →</Link>
        {" · "}
        <Link to="/hr/family-genome">Import all six desks as one declared genome →</Link>
      </p>
    </>
  );
}
