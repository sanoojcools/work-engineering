import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import {
  OFFER_DESK_EXCEPTIONS,
  OFFER_DESK_HANDOFFS,
  OFFER_DESK_META,
  OFFER_DESK_STEPS,
  OFFER_DESK_TOTAL_SAVINGS,
} from "../lib/offerDeskData";

export default function OfferDeskSheet() {
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · declared write-up, not a system log
      </p>
      <h2>
        The spreadsheet we were given{" "}
        <InfoTooltip
          term="Declared ingest"
          simple="The Offer Desk workbook is a write-up of Rashmi's session on 12 May 2026. Structured, useful, still talk written down carefully. It is not Zwayam."
        />
      </h2>
      <p className="lede">
        OfferDesk_Agent_Ready.xlsx · declared write-up of Rashmi&apos;s session. We do not treat this file as Zwayam.
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>What is inside the workbook</h3>
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }}>
          <li>Metadata: {OFFER_DESK_META.workflowName}</li>
          <li>{OFFER_DESK_STEPS.length} micro-steps with times</li>
          <li>{OFFER_DESK_HANDOFFS.length} handoffs</li>
          <li>{OFFER_DESK_EXCEPTIONS.length} exceptions</li>
          <li>Automation readiness claiming {OFFER_DESK_TOTAL_SAVINGS}</li>
        </ul>
        <p style={{ fontSize: 13, margin: 0 }}>
          Source: {OFFER_DESK_META.interviewSource}. If a later screen says a system showed it, that field is still empty in this demo.
          Zero Zwayam events are claimed.
        </p>
      </div>

      <IoPanes
        given="The workbook, as attached."
        understood="Structured declared capture: outcome, trigger, SLA, 11 steps, 9 exceptions, 10 handoffs, a 95-hour month claim."
        processed="Parser reads rows. It does not invent Zwayam events. Provenance on every field: person said / written in the sheet."
        output="A source card the later screens can point at. Not observed. Not traces."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/save-talk-only">First: save talk-only (should fail) →</Link>
      </p>
    </>
  );
}
