import { DesignedRoom } from "../components/offerDesk/DesignedRoom";
import { useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { OFFER_DESK_META, OFFER_DESK_SAMPLE_ROWS, OFFER_DESK_STEPS } from "../lib/offerDeskData";

export default function OfferDeskRashmi() {
  const seat = useOfferDeskSeat("sme");
  const step2 = OFFER_DESK_STEPS.find((s) => s.step === 2);
  const row2 = OFFER_DESK_SAMPLE_ROWS.find((r) => r.name.startsWith("2."));

  return (
    <DesignedRoom
      seat="sme"
      hook={seat}
      title="Offer Desk SME · Rashmi KN"
      lede={`${OFFER_DESK_META.interviewSource}. Sheet first — not a summary, not Zwayam events.`}
      next={{ to: "/scout/offer-desk/playback", label: "Play the three seats back →" }}
    >
      <div data-testid="rashmi-sheet">
        {step2 && row2 && (
          <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent-edge)" }}>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
              Sheet step 2 — the one this walk must show
            </div>
            <h3 style={{ marginBottom: 8 }}>{row2.name}</h3>
            <p style={{ fontSize: 13, whiteSpace: "pre-line" }}>{step2.whatHappens}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, marginBottom: 8 }}>
              <span>
                <strong>Time (sheet):</strong> {step2.timePerCase}
              </span>
              <span>·</span>
              <span>
                <strong>System:</strong> {step2.system}
              </span>
              <span>·</span>
              <span className="badge">{step2.automationTag}</span>
            </div>
            {row2.pain && <p style={{ fontSize: 13, margin: 0 }}>{row2.pain}</p>}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <h3>The eleven micro-steps from the sheet</h3>
          <div className="table-wrap rashmi-steps" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>What she does</th>
                  <th>Minutes (sheet)</th>
                  <th>System</th>
                  <th>How automatic it already is</th>
                </tr>
              </thead>
              <tbody>
                {OFFER_DESK_STEPS.map((s, i) => {
                  const name = OFFER_DESK_SAMPLE_ROWS[i]?.name ?? `Step ${s.step}`;
                  const isStep2 = s.step === 2;
                  return (
                    <tr
                      key={s.step}
                      className={isStep2 ? "this-walk" : undefined}
                      data-testid={isStep2 ? "rashmi-this-walk" : undefined}
                    >
                      <td>{s.step}</td>
                      <td>
                        {name.replace(/^\d+\.\s*/, "")}
                        {isStep2 && (
                          <span className="badge" style={{ marginLeft: 8 }}>
                            this walk
                          </span>
                        )}
                      </td>
                      <td>{s.timePerCase}</td>
                      <td>{s.system}</td>
                      <td>{s.automationTag}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {seat.session && (
            <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
              Interview completeness on the platform: {seat.session.completeness_pct.toFixed(0)}%. Completeness is not
              permission to save. Talk-only persist stays denied.
            </p>
          )}
        </div>
      </div>
    </DesignedRoom>
  );
}
