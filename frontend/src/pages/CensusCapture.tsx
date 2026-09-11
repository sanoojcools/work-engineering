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

/** CENSUS-v0 Part A, step 2: Capture. Three seats, and — per the build
 * doc's own rule — Offer Desk is linked FROM here, not from Home. V10-12
 * adds four counts (invented / left out / twisted / flattered) on this
 * same step — not a seventh census step. Nothing new as a capture
 * mechanism: this page is a shell over the existing three-seat walk
 * (SeatStepper / OFFER_DESK_SEAT_PATHS). */
export default function CensusCapture() {
  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Capture <InfoTooltip term="Capture" simple="Three seats sit for the same journey: a function leader, a sub-function lead, and the SME who actually runs the desk. Playback keeps their three answers separate." />
      </h2>
      <p className="lede">
        Every Work Census captures through three seats, not one interview. Offer Desk is this build's real worked
        example — reached from here, not from Home.
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
        understood="One seat's voice is not a census. Function leader, sub-function lead, and SME each answer for themselves; playback lines them up without merging them."
        processed="This page links to the existing three-seat Offer Desk walk (SeatStepper) and reads this tenant's four counts. Guest never calls that. No second capture mechanism, no new store."
        output={
          "Three seats named. Offer Desk reachable from here, not from Home. Four counts: invented / left out / twisted / flattered."
        }
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/">← Scope</Link>
        <Link to="/census/evidence">Next: Evidence →</Link>
      </p>
    </>
  );
}
