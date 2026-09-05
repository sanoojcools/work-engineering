import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";

export default function HrOps() {
  return (
    <>
      <h2>HR operations</h2>
      <p className="lede">Desks that run after a hire is decided and before the person lands.</p>
      <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Link to="/scout/offer-desk" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>Offer Desk</h3>
          <p className="hint">Live · Rashmi · 3 cities</p>
        </Link>
        <div className="card" style={{ opacity: 0.7 }}>
          <h3>Onboarding SPOC</h3>
          <p className="hint">Receives Rashmi’s handover</p>
        </div>
        <div className="card" style={{ opacity: 0.7 }}>
          <h3>Offboarding</h3>
          <p className="hint">On the map</p>
        </div>
      </div>
      <IoPanes
        given="CHRO map chose HR operations."
        understood="Offer Desk owns offer release, document check, payroll inputs. Onboarding SPOC owns Day 1."
        processed="We do not fold SPOC work into Offer Desk."
        output="Offer Desk opens. Same V8 page, now on the V9 path."
      />
    </>
  );
}
