import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";

/** CENSUS-v0 Part A, step 6: Plan. Links only -- V10's own instruction is
 * not to rebuild Plan this PR. Points at the three real, already-shipped
 * pages a plan actually needs: the Document check VERDICT card, declared
 * vs. defended Hours, and function-wide declared hours across six desks. */
export default function CensusPlan() {
  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Plan <InfoTooltip term="Plan" simple="Not rebuilt this slice — links to the three real numbers a plan needs today: VERDICT allocation, declared vs. defended hours, and function-wide declared hours." />
      </h2>
      <p className="lede">
        The Work Chart is the plan's own picture. This step is links only, to the three pages that already carry
        real numbers — nothing new is computed here.
      </p>

      <div className="stack" style={{ gap: 12 }}>
        <Link to="/scout/offer-desk/document-check" className="card" style={{ textDecoration: "none", color: "inherit", margin: 0 }}>
          <h3>Document check — VERDICT</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            S1/S2/S3 allocation scenarios on the one real, scored unit this walk carries — the same scores the Work
            Chart's own toggle replays.
          </p>
        </Link>
        <Link to="/scout/offer-desk/hours" className="card" style={{ textDecoration: "none", color: "inherit", margin: 0 }}>
          <h3>Hours — 95 declared / 61.8 defended</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            Offer Desk's own declared sheet claim next to the defended case after four costing disciplines. Neither
            number is hidden behind the other.
          </p>
        </Link>
        <Link to="/hr/function-hours" className="card" style={{ textDecoration: "none", color: "inherit", margin: 0 }}>
          <h3>Function hours — six desks</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            Every desk's own declared hrs/mo line, verbatim, summed — stated across sittings, not a second defended
            case.
          </p>
        </Link>
      </div>

      <IoPanes
        given="Work Chart: the journey's two lanes, real or declared-schematic."
        understood="A plan is only as good as the numbers under it. This step does not invent a fourth number."
        processed="Links only to three existing pages — no rebuild, no new arithmetic."
        output="VERDICT, Hours, and function hours all one click away."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/census/chart">← Work Chart</Link>
      </p>
    </>
  );
}
