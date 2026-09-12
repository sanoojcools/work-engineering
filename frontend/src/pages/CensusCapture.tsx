import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { OFFER_DESK_SEATS } from "../lib/offerDeskSeats";
import { ExtractCounts } from "../components/census/ExtractCounts";

const SEAT_ORDER: (keyof typeof OFFER_DESK_SEATS)[] = ["function_head", "sub_function_lead", "sme"];
const SEAT_LABELS: Record<keyof typeof OFFER_DESK_SEATS, string> = {
  function_head: "1. Function leader",
  sub_function_lead: "2. Sub-function lead",
  sme: "3. SME",
};

/** Census step 2: Capture. Three seats plus four counts on this same
 * step — not a seventh census step. Offer Desk is the worked example;
 * open it from the button on this page. */
export default function CensusCapture() {
  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Capture <InfoTooltip term="Capture" simple="Three seats sit for the same journey: a function leader, a desk lead, and the person who does the work. Playback keeps their three answers separate." />
      </h2>
      <p className="lede">
        We sit with three people for the same journey: the function leader, the desk lead, and the person who does the
        work. Offer Desk is the worked example. Open it from the button below.
      </p>

      <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {SEAT_ORDER.map((key) => {
          const seat = OFFER_DESK_SEATS[key];
          return (
            <div className="card" key={key} style={{ margin: 0 }}>
              <h3 style={{ fontSize: 14 }}>{SEAT_LABELS[key]}</h3>
              <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>
                {seat.interviewee_name}
                {seat.standIn ? " — labelled stand-in until a real sitting exists" : " — real sitting"}
              </p>
            </div>
          );
        })}
      </div>

      <ExtractCounts />

      <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent-edge)" }}>
        <h3>Offer Desk — this census's worked example</h3>
        <p style={{ fontSize: 13, marginBottom: 10 }}>
          Three seats, then playback, then the cut. Eleven real steps transcribed from a real sitting (Rashmi KN, 12
          May 2026) — pre-onboarding: offer release, document check, payroll inputs.
        </p>
        <Link
          to="/scout/offer-desk"
          className="primary"
          style={{ display: "inline-block", textDecoration: "none", padding: "7px 14px", background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)", fontWeight: 550 }}
        >
          Open the Offer Desk capture walk →
        </Link>
      </div>

      <IoPanes
        given="Scope: which functions and sub-functions are in play."
        understood="One person's voice is not a census. The function leader, the desk lead, and the person who does the work each answer for themselves; playback lines them up without merging them."
        processed="We open the three Offer Desk sittings and show four counts for how the notes were read. A guest sees zeros until someone is signed in and notes are saved."
        output="Three seats named. Offer Desk opens from the button on this page. Four counts: invented, left out, twisted, flattered."
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/">← Scope</Link>
        <Link to="/census/evidence">Next: Evidence →</Link>
      </p>
    </>
  );
}
