import { Link } from "react-router-dom";
import { DemoSetup } from "../components/DemoSetup";
import { IoPanes } from "../components/IoPanes";

export default function Start() {
  return (
    <>
      <h2>How do you want to start?</h2>
      <p className="lede">
        Two doors. The live path is Enterprise → HR → HR operations → Offer Desk.
      </p>
      <DemoSetup />
      <div className="split" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Link to="/enterprise" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>Enterprise track</h3>
          <p style={{ fontSize: 14, margin: 0 }}>
            A company with HR, Finance, Legal, Operations. We start in HR operations at the Offer Desk.
          </p>
          <p className="hint">Open this first.</p>
        </Link>
        <div className="card" style={{ opacity: 0.75 }}>
          <h3>SME track</h3>
          <p style={{ fontSize: 14, margin: 0 }}>
            A single specialist sitting, without the company map. Not built yet. Rashmi’s interview will later live here too.
          </p>
          <p className="hint">Listed only.</p>
        </div>
      </div>
      <IoPanes
        given="You opened the product."
        understood="We need to know whether this is a company walk or a lone specialist."
        processed="No work is cut yet. We only choose a door."
        output="Enterprise is live. SME is a label."
      />
      <p className="hint" style={{ marginTop: 24 }}>
        V8 Overview, Genome, and VERDICT are still in the nav under Specification / Analysis.
      </p>
    </>
  );
}
