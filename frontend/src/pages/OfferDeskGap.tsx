import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { GAP_ROWS } from "../lib/offerDeskWorkRecord";

export default function OfferDeskGap() {
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · declared vs sitting
      </p>
      <h2>
        The gap is the finding{" "}
        <InfoTooltip
          term="Conformance gap"
          simple="What upstairs named versus what the sitting described. We do not vote the three columns into one story."
        />
      </h2>
      <p className="lede">
        Playback kept three columns. This page names the disagreement. That disagreement is the commercial output of discovery, not a defect to hide.
      </p>
      <SeatStepper />

      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Declared</th>
              <th>Sitting</th>
              <th>Gap</th>
            </tr>
          </thead>
          <tbody>
            {GAP_ROWS.map((row) => (
              <tr key={row.topic}>
                <td>{row.topic}</td>
                <td>{row.declared}</td>
                <td>{row.sitting}</td>
                <td>{row.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IoPanes
        given="CHRO stand-in, HR Ops stand-in, Rashmi sitting, the sheet."
        understood="Declared upstairs is not the same record as declared at the desk."
        processed="We write the disagreement down. We do not invent Zwayam events to close it."
        output="Four named gaps. Hours and systems stay labelled declared."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/document-check">Open document check →</Link>
      </p>
    </>
  );
}
