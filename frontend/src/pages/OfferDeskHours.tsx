import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";

const DISCIPLINES = [
  {
    name: "1. Keep the sheet claim visible",
    does: "95 hrs/mo stays on screen as declared. We do not overwrite it with a prettier number.",
  },
  {
    name: "2. Do not treat per-case minutes as a measured month",
    does: "The sheet times are per case. A month total needs volume that this walk did not observe.",
  },
  {
    name: "3. Do not count a step twice because two seats named it",
    does: "CHRO stand-in and the desk both talk about documents. That is one cut, not two savings lines.",
  },
  {
    name: "4. Hold unverified exception and automation claims out of the defended case",
    does: "Transition notes say Zwayam and Zoho are moving. This demo has zero events. Those hours are not defended.",
  },
];

export default function OfferDeskHours() {
  const rec = DOCUMENT_CHECK_RECORD;
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · declared 95 · defended 61.8
      </p>
      <h2>
        Hours{" "}
        <InfoTooltip
          term="Defended hours"
          simple="A number we will still say after costing discipline. Not a measurement taken on this desk this week."
        />
      </h2>
      <p className="lede">
        Both numbers stay visible. {rec.declaredHours} is the sheet claim ({rec.declaredHoursLabel}). {rec.defendedHours} is the defended case after four costing disciplines. Neither is a live month on this tenant.
      </p>
      <SeatStepper />

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Declared</div>
          <p style={{ fontSize: 28, margin: "4px 0" }}>{rec.declaredHours}</p>
          <p style={{ fontSize: 13, margin: 0 }}>hrs/mo on the workbook automation-readiness line.</p>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Defended</div>
          <p style={{ fontSize: 28, margin: "4px 0" }}>{rec.defendedHours}</p>
          <p style={{ fontSize: 13, margin: 0 }}>hrs/mo after the four disciplines below. Still declared math, not traces.</p>
        </div>
      </div>

      {DISCIPLINES.map((row) => (
        <div className="card" key={row.name} style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>{row.name}</h3>
          <p style={{ fontSize: 13, margin: 0 }}>{row.does}</p>
        </div>
      ))}

      <IoPanes
        given="Workbook claim of ~95 hrs/mo and per-case times on eleven steps."
        understood="A claim is not a measurement. Volume, overlap, and unobserved systems cannot be spent twice."
        processed="Four disciplines. No agent scoring. No invented Zwayam volume."
        output={`${rec.declaredHours} stays labelled declared. ${rec.defendedHours} is the defended case. Both remain on the sitting record.`}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/spec-deny">Ask Spec without a pass →</Link>
      </p>
    </>
  );
}
