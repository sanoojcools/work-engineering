import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { StartCensus } from "../components/census/StartCensus";
import { DemoSetup } from "../components/DemoSetup";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";

/** CENSUS-v0 Part A, step 1: Scope. Home IS this step, guest or keyed --
 * not a separate landing page ahead of the six-step census. Content is the
 * existing Enterprise -> HR map -> Function Scope pages, relabelled: what
 * this build used to call "blast radius" is customer-facing "Scope" here
 * (docs/BUILD_PROGRAM.md CENSUS-v0's own copy rule). V10-1 adds Start
 * census + an honest readiness strip from GET /api/censuses. Offer Desk is
 * deliberately NOT linked from this page: it is Capture depth, reachable
 * from step 2, not from Home. */
export default function Start() {
  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Scope <InfoTooltip term="Scope" simple="Which functions and sub-functions are in play, before any work is captured. What this build used to call blast radius." />
      </h2>
      <p className="lede">
        Today's HR map: what's live, what's still on the map, and who owns each sub-function. You can look without
        a key — every screen on this walk renders read-only. Writes stay denied until you sign in for real.
      </p>

      <StartCensus />

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Link to="/enterprise" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>Enterprise → HR map</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            Which functions are live today (HR) versus still on the map (Finance, Legal, Operations), then the CHRO
            map of HR operations and HR business partner.
          </p>
        </Link>
        <Link to="/scout/blast-radius" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>Function Scope</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            The 44 sub-function HR catalog — check what's in scope for this census, name who owns it.
          </p>
        </Link>
      </div>

      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          Set up the demo (for people who will save)
        </summary>
        <p className="hint" style={{ marginTop: 8 }}>
          Mints a real key and signs this browser in, so Capture, Evidence, and Ratify actually write. Not needed
          just to look.
        </p>
        <DemoSetup />
      </details>

      <IoPanes
        given="You opened the product."
        understood="Most people want to look first. A key is only for the person who will actually save something."
        processed="Scope renders fully with no key — the readiness strip is honestly empty, Start does not mint a key, and the HR map is read-only. Every write stays denied until you sign in for real."
        output="Enterprise and Function Scope are live, no sign-in required. Capture is next."
      />

      <p className="hint" style={{ marginTop: 24 }}>
        V8 Overview, Genome, and VERDICT stay in the nav under Specification / Analysis.
      </p>

      <p style={{ marginTop: 20 }}>
        <Link to="/census/capture">Next: Capture →</Link>
      </p>
    </>
  );
}
