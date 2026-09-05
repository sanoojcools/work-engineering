import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { HR_OPS_STAND_IN } from "../lib/offerDeskSeats";

export default function OfferDeskSubFunctionLead() {
  const seat = useOfferDeskSeat("sub_function_lead");
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · seat 2 of 3
      </p>
      <h2>
        Interview 2 · Sub-function lead{" "}
        <InfoTooltip
          term="Stand-in"
          simple="Labelled until a real Head of HR operations sitting is recorded. Boundaries come from the Offer Desk handoff map, not from a quoted interview."
        />
      </h2>
      <p className="lede">Head of HR operations · how the desks are meant to run. Not a recorded sitting.</p>
      <SeatStepper />
      <SeatSessionBar
        seat="sub_function_lead"
        session={seat.session}
        needsKey={seat.needsKey}
        error={seat.error}
        busy={seat.busy}
        onRetry={seat.retry}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>We asked · what the workbook implies for this seat</h3>
        <div className="stack" style={{ gap: 12 }}>
          {HR_OPS_STAND_IN.map((row) => (
            <div key={row.asked} style={{ border: "1px solid var(--line)", padding: 12 }}>
              <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>{row.asked}</div>
              <p style={{ fontSize: 14, margin: "6px 0" }}>{row.used}</p>
              <p className="hint" style={{ marginBottom: 0 }}>Workbook source: {row.source}</p>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
          This seat is a stand-in. Offer Desk is not Onboarding. Handoffs stay as links, not extra steps inside Rashmi&apos;s unit.
        </p>
      </div>

      <IoPanes
        given="Handoff map and transition state rows from the sheet."
        understood="HR Ops is a chain of desks, not one queue. Offer Desk is not Onboarding."
        processed="We keep handoffs as links, not as extra steps inside Rashmi's unit. Darwinbox is named as coming, not arrived."
        output="A boundary: Offer Desk ends at handover. SPOC work is out of scope for this cut."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/rashmi">Next · 3. Rashmi →</Link>
      </p>
    </>
  );
}
