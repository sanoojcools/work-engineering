import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";

const LINES = [
  ["Sitting", DOCUMENT_CHECK_RECORD.sitting],
  ["Cut", DOCUMENT_CHECK_RECORD.name],
  ["Object", DOCUMENT_CHECK_RECORD.businessObject],
  ["From → to", `${DOCUMENT_CHECK_RECORD.currentCondition} → ${DOCUMENT_CHECK_RECORD.desiredCondition}`],
  ["Owner", DOCUMENT_CHECK_RECORD.owner],
  ["Provenance", "Declared. Talk and a workbook. Not traces."],
  ["Talk-only persist", "Denied. Zero Work Units written."],
  ["Hours", `${DOCUMENT_CHECK_RECORD.declaredHours} declared / ${DOCUMENT_CHECK_RECORD.defendedHours} defended`],
  ["Helper", `${DOCUMENT_CHECK_RECORD.helperMay} ${DOCUMENT_CHECK_RECORD.helperMayNot}`],
  ["Stop", DOCUMENT_CHECK_RECORD.stopRule],
  ["Spec", "Ask without a pass → denied. Empty evidence_ref."],
  ["Agents", "None. No autonomy scoring on this walk."],
] as const;

export default function OfferDeskSittingRecord() {
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · end of the colleague walk
      </p>
      <h2>Sitting record</h2>
      <p className="lede">
        What this walk produced. Read it aloud. Nothing here is a saved Work Unit, a measured month, or a released offer.
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="table-wrap" style={{ marginBottom: 0 }}>
          <table>
            <tbody>
              {LINES.map(([k, v]) => (
                <tr key={k}>
                  <th style={{ width: "28%" }}>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <IoPanes
        given="Three seats, a sheet, a refused persist, a cut, a gap, a helper list, two hour numbers, a Spec deny."
        understood="Completeness of a conversation is not clearance to write the company list or to act."
        processed="The walk stopped at the specification layer. No execution. No agent."
        output="This card. Screenshot it. That is the artefact."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/">Back to Home</Link>
        {" · "}
        <Link to="/scout/offer-desk/rashmi">Replay the sitting</Link>
      </p>
    </>
  );
}
