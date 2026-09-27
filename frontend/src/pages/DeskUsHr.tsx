import { Link } from "react-router-dom";
import { useIsGuest } from "../lib/guestMode";
import { US_HR_SPEC } from "../lib/desks/usHr";
import type { DeskStep } from "../lib/desks/types";
import { specialistById } from "../lib/trianzPc";

/** Plan 95 and 61.8 stay on Offer Desk Plan. This walk copies the sheet
 * and does not print those two numbers. Rashmi KN also runs Offer Desk —
 * two desks, two walks, not one merged node. */
function stepHint(step: DeskStep): string {
  return [step.system, step.spoc, step.timePerCase, step.volumePerMonth, step.automationTag]
    .filter((part) => !part.includes("95") && !part.includes("61.8"))
    .join(" · ");
}

/** US HR walk. Who runs the desk first. Rashmi KN's 10 sheet steps stay
 * behind "Desk as sat", closed. Hours are the sheet's own ~4 hrs/day line.
 * Status stays needs-follow-up. Looking only — this page does not mint a key. */
export default function DeskUsHr() {
  const spec = US_HR_SPEC;
  const boss = specialistById("us-hr").boss;
  const isGuest = useIsGuest();

  return (
    <div data-testid="ushr-walk">
      <p className="hint" style={{ marginBottom: 4 }}>
        Trianz P&C · US HR
      </p>
      <h2>{spec.name}</h2>
      <p className="lede">
        Who runs it comes first. The steps Rashmi KN sat are behind the fold.
      </p>

      <div className="card" data-testid="ushr-who" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Who runs it</h3>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }} data-testid="ushr-runners">
          Rashmi KN
        </p>
        <p style={{ fontSize: 14, margin: "0 0 6px" }} data-testid="ushr-backup">
          Backup: {spec.backup}
        </p>
        <p style={{ fontSize: 14, margin: "0 0 6px" }} data-testid="ushr-boss">
          Boss: {boss}
        </p>
        {spec.status === "needs_follow_up" && (
          <p style={{ fontSize: 14, margin: "0 0 10px" }} data-testid="ushr-status">
            Needs follow-up
          </p>
        )}
        <p style={{ fontSize: 14, margin: 0 }} data-testid="ushr-hours">
          {spec.monthlyEffortProfile[0]}
        </p>
      </div>

      <details style={{ marginBottom: 20 }} data-testid="desk-as-sat">
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Desk as sat (Rashmi KN)</summary>
        <p className="hint" style={{ marginTop: 8 }}>
          Source: {spec.interviewSource}. Sheet language, not a scrape.
        </p>
        <h3>The {spec.steps.length} steps</h3>
        <div className="stack" style={{ gap: 14, marginBottom: 8 }}>
          {spec.steps.map((step) => (
            <div key={step.id} className="card" style={{ margin: 0 }} data-testid="ushr-step">
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {step.id}
                </span>
                <strong style={{ fontSize: 14 }}>{step.name}</strong>
              </div>
              <p style={{ fontSize: 13, margin: "0 0 8px" }}>{step.whatHappens}</p>
              <p className="hint" style={{ margin: 0 }}>
                {stepHint(step)}
              </p>
            </div>
          ))}
        </div>
      </details>

      {isGuest && (
        <p className="hint" data-testid="ushr-guest">
          Looking only.
        </p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link to="/">← Trianz P&C</Link>
      </p>
    </div>
  );
}
