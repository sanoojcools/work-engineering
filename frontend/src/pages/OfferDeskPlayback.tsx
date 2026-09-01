import { Link } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { OFFER_DESK_SEATS, PLAYBACK_ROWS } from "../lib/offerDeskSeats";
import { INTERVIEW_TYPE_LABELS } from "../types";

export default function OfferDeskPlayback() {
  const chro = useOfferDeskSeat("function_head");
  const ops = useOfferDeskSeat("sub_function_lead");
  const rashmi = useOfferDeskSeat("sme");

  const columns = [
    { seat: "function_head" as const, hook: chro, heading: "CHRO stand-in" },
    { seat: "sub_function_lead" as const, hook: ops, heading: "HR Ops lead" },
    { seat: "sme" as const, hook: rashmi, heading: "Rashmi" },
  ];

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · three seats, not one story
      </p>
      <h2>
        Playback · three seats{" "}
        <InfoTooltip
          term="Playback"
          simple="Four panes on every stage: given, how we understand it, what the platform does, what you can see. Here the three sittings sit in three columns. We do not vote them into one story."
        />
      </h2>
      <p className="lede">We do not vote the rows into one story.</p>
      <SeatStepper />

      {(chro.needsKey || ops.needsKey || rashmi.needsKey) && (
        <ApiKeyBanner onSaved={() => { void chro.retry(); void ops.retry(); void rashmi.retry(); }} />
      )}

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {columns.map((col) => (
          <SeatSessionBar
            key={col.seat}
            seat={col.seat}
            session={col.hook.session}
            needsKey={col.hook.needsKey}
            error={col.hook.error}
            busy={col.hook.busy}
            onRetry={col.hook.retry}
            showKeyBanner={false}
          />
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Same topics, three answers</h3>
        <div className="table-wrap" style={{ marginBottom: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>CHRO stand-in</th>
                <th>HR Ops lead</th>
                <th>Rashmi</th>
              </tr>
            </thead>
            <tbody>
              {PLAYBACK_ROWS.map((row) => (
                <tr key={row.topic}>
                  <td><strong>{row.topic}</strong></td>
                  <td>{row.function_head}</td>
                  <td>{row.sub_function_lead}</td>
                  <td>{row.sme}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {columns.map((col) => {
          const spec = OFFER_DESK_SEATS[col.seat];
          const units = col.hook.session?.units ?? [];
          return (
            <div key={col.seat} className="card" style={{ margin: 0 }}>
              <h3>{col.heading}</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                {INTERVIEW_TYPE_LABELS[spec.type]}
                {spec.standIn ? " · stand-in" : " · real sitting"}
              </p>
              {spec.standIn && units.length === 0 && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Empty on purpose. A labelled stand-in is not a captured grid. We do not fill it to look complete.
                </p>
              )}
              {units.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                  {units.map((u) => (
                    <li key={u.id} style={{ marginBottom: 6 }}>
                      <strong>{u.name}</strong>
                      {u.time_minutes != null && <> · {u.time_minutes} min (grid)</>}
                      {u.pain ? <div className="hint" style={{ margin: "2px 0 0" }}>{u.pain}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <IoPanes
        given="Three declared sittings. Rashmi's is real. The two above her are labelled stand-ins until recorded."
        understood="Disagreement is expected: upstairs talks outcomes, the desk talks trackers."
        processed="We line them up. We do not merge. We do not waive persist. Completeness is not clearance."
        output="Talk-only picture. Spreadsheet and save-talk-only are the next slices, not this one."
      />

      <p className="hint" style={{ marginTop: 20, marginBottom: 0 }}>
        Slice B stops here. Spreadsheet attach and talk-only save are Slice C.{" "}
        <Link to="/scout/offer-desk">Back to Offer Desk</Link>
      </p>
    </>
  );
}
