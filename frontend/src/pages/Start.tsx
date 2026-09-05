import { Link } from "react-router-dom";
import { DemoSetup } from "../components/DemoSetup";
import { IoPanes } from "../components/IoPanes";

export default function Start() {
  return (
    <>
      <h2>How do you want to start?</h2>
      <p className="lede">
        You can look without a key — the full 12-minute Offer Desk walk works read-only, no setup, no sign-in.
        Writes stay denied until you sign in for real.
      </p>
      <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent-edge)" }}>
        <h3>Look — no key needed</h3>
        <p style={{ fontSize: 14, margin: "0 0 10px" }}>
          Enterprise → HR → HR operations → Offer Desk: three seats, playback, save talk-only (denied, on purpose),
          the cut, the gap, document check, hours, Spec deny, sitting record. Every screen renders; every write
          stays denied. Nothing is saved and nothing needs to be.
        </p>
        <Link
          to="/enterprise"
          className="primary"
          style={{ display: "inline-block", textDecoration: "none", padding: "7px 14px", background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)", fontWeight: 550 }}
        >
          Start the walk →
        </Link>
      </div>

      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          Set up the demo (for people who will save)
        </summary>
        <p className="hint" style={{ marginTop: 8 }}>
          Mints a real key and signs this browser in, so Save talk-only, Spec deny → upload, and the evidence-pack
          import actually write. Not needed just to look.
        </p>
        <DemoSetup />
      </details>

      <IoPanes
        given="You opened the product."
        understood="Most people want to look first. A key is only for the person who will actually save something."
        processed="The walk renders fully with no key. Every write on it still asks for one and stays denied without it."
        output="Enterprise is live, no sign-in required. Set up the demo is one click away when you're ready to save."
      />
      <p className="hint" style={{ marginTop: 24 }}>
        V8 Overview, Genome, and VERDICT stay in the nav under Specification / Analysis.
      </p>
    </>
  );
}
