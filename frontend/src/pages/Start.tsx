import { Link } from "react-router-dom";
import { DemoSetup } from "../components/DemoSetup";
import { IoPanes } from "../components/IoPanes";

export default function Start() {
  return (
    <>
      <h2>How do you want to start?</h2>
      <p className="lede">
        Colleague walk (12 min): Set up the demo, then Offer Desk SME → Playback → Spreadsheet → Save talk-only → How we cut it → Gap → Document check → Hours → Spec deny → Sitting record.
      </p>
      <DemoSetup />
      <div className="split" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Link to="/enterprise" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>Enterprise track</h3>
          <p style={{ fontSize: 14, margin: 0 }}>
            A company with HR, Finance, Legal, Operations. We start in HR operations at the Offer Desk.
          </p>
          <p className="hint">Open this first after Set up the demo.</p>
        </Link>
        <Link to="/scout/offer-desk/rashmi" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>Jump to Offer Desk SME</h3>
          <p style={{ fontSize: 14, margin: 0 }}>
            Rashmi stays on the sitting page. The tab is Offer Desk SME. Use this if setup is already done.
          </p>
          <p className="hint">Needs the demo key.</p>
        </Link>
      </div>
      <IoPanes
        given="You opened the product."
        understood="We need a key, then a door into HR operations at Offer Desk."
        processed="No work is cut yet. Setup mints the key. The walk is twelve screens."
        output="Enterprise is live. The sitting record is the close. SME-as-a-product-track is still a label."
      />
      <p className="hint" style={{ marginTop: 24 }}>
        V8 Overview, Genome, and VERDICT stay in the nav under Specification / Analysis.
      </p>
    </>
  );
}
