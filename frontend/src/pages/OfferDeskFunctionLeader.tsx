import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { CHRO_STAND_IN } from "../lib/offerDeskSeats";

export default function OfferDeskFunctionLeader() {
  const seat = useOfferDeskSeat("function_head");
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · seat 1 of 3
      </p>
      <h2>
        Interview 1 · Function leader{" "}
        <InfoTooltip
          term="Stand-in"
          simple="Labelled until a real CHRO sitting is recorded. Policies come from the Offer Desk workbook, not from a quoted function-head interview."
        />
      </h2>
      <p className="lede">CHRO · what must stay true. Not a recorded sitting.</p>
      <SeatStepper />
      <SeatSessionBar
        seat="function_head"
        session={seat.session}
        needsKey={seat.needsKey}
        error={seat.error}
        busy={seat.busy}
        onRetry={seat.retry}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>We asked · what we use as the CHRO voice for this demo</h3>
        <div className="stack" style={{ gap: 12 }}>
          {CHRO_STAND_IN.map((row) => (
            <div key={row.asked} style={{ border: "1px solid var(--line)", padding: 12 }}>
              <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>{row.asked}</div>
              <p style={{ fontSize: 14, margin: "6px 0" }}>{row.used}</p>
              <p className="hint" style={{ marginBottom: 0 }}>Workbook source: {row.source}</p>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
          This seat is a stand-in until a real CHRO sitting is recorded. Labelled as such. Nothing here is saved as a Work Unit.
        </p>
      </div>

      <IoPanes
        given="Policies from the workbook: UAN stop, salary grid, 2-hour SLA."
        understood="CHRO cares about risk and coverage. She may not name Master Joining Sheet."
        processed="We store this as declared. We mark the seat as a stand-in. We do not invent a sitting."
        output="Intent: safe offer release, three cities, a real backup."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/sub-function-lead">Next · 2. Sub-function lead →</Link>
      </p>
    </>
  );
}
