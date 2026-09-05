import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { DOCUMENT_CHECK_RECORD, HOW_WE_CUT } from "../lib/offerDeskWorkRecord";

export default function OfferDeskHowWeCut() {
  const rec = DOCUMENT_CHECK_RECORD;
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · how we cut it · not a saved Work Unit
      </p>
      <h2>
        How we cut it{" "}
        <InfoTooltip
          term="Cut"
          simple="A cut is one owner, one business object, one proof a stranger can check. Sheet rows are not cuts."
        />
      </h2>
      <p className="lede">
        Sheet step {rec.sheetStep} becomes one work record. Talk-only persist already refused to write it into the company list.
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>The record this walk hangs on</div>
        <h3 style={{ marginBottom: 8 }}>{rec.name}</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li>Object: {rec.businessObject}</li>
          <li>From: {rec.currentCondition}</li>
          <li>To: {rec.desiredCondition}</li>
          <li>Owner: {rec.owner}</li>
          <li>Sitting: {rec.sitting}</li>
          <li>Proof required: {rec.evidenceRequired}</li>
          <li>Stop: {rec.stopRule}</li>
        </ul>
        <p className="hint" style={{ marginBottom: 0 }}>
          Declared capture. Not observed. Not written as a Work Unit.
        </p>
      </div>

      {HOW_WE_CUT.map((row) => (
        <div className="card" key={row.from} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, margin: "0 0 6px" }}>
            <strong>From the sheet.</strong> {row.from}
          </p>
          <p style={{ fontSize: 13, margin: "0 0 6px" }}>
            <strong>Cut.</strong> {row.to}
          </p>
          <p className="hint" style={{ margin: 0 }}>
            Why: {row.why}
          </p>
        </div>
      ))}

      <IoPanes
        given="Eleven sheet rows plus two stand-in seats."
        understood="A cut is owner × object × proof. Dual employment lives inside document check."
        processed="We keep one record visible. We do not fold salary grid or the 17th pack into it to look tidier."
        output="A declared work record. Still not in the company work list."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/gap">Show the gap next →</Link>
      </p>
    </>
  );
}
