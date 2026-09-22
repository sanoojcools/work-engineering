import { Link } from "react-router-dom";
import { useIsGuest } from "../lib/guestMode";
import { ONBOARDING_SPEC } from "../lib/desks/onboarding";
import { specialistById } from "../lib/trianzPc";

/** Onboarding walk. Who runs the desk first. Prerana's 23 sheet steps stay
 * behind "Desk as sat", closed. Hours are the sheet's own ~22 hrs/mo line.
 * Looking only — this page does not mint a key. */
export default function DeskOnboarding() {
  const spec = ONBOARDING_SPEC;
  const boss = specialistById("onboarding").boss;
  const isGuest = useIsGuest();

  return (
    <div data-testid="onboarding-walk">
      <p className="hint" style={{ marginBottom: 4 }}>
        Trianz P&C · Onboarding
      </p>
      <h2>{spec.name}</h2>
      <p className="lede">
        Who runs it comes first. The steps Prerana sat are behind the fold.
      </p>

      <div className="card" data-testid="onboarding-who" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Who runs it</h3>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }} data-testid="onboarding-runners">
          Prerana BLR / Sasikala HYD / Thamizh CHN
        </p>
        <p style={{ fontSize: 14, margin: "0 0 6px" }} data-testid="onboarding-backup">
          Backup: Reshma
        </p>
        <p style={{ fontSize: 14, margin: "0 0 10px" }} data-testid="onboarding-boss">
          Boss: {boss}
        </p>
        <p style={{ fontSize: 14, margin: 0 }} data-testid="onboarding-hours">
          {spec.totalEstimatedSavings}
        </p>
      </div>

      <details style={{ marginBottom: 20 }} data-testid="desk-as-sat">
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Desk as sat (Prerana)</summary>
        <p className="hint" style={{ marginTop: 8 }}>
          Source: {spec.interviewSource}. Sheet language, not a scrape.
        </p>
        <h3>The {spec.steps.length} steps</h3>
        <div className="stack" style={{ gap: 14, marginBottom: 8 }}>
          {spec.steps.map((step) => (
            <div key={step.id} className="card" style={{ margin: 0 }} data-testid="onboarding-step">
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
                {step.system} · {step.spoc} · {step.timePerCase} · {step.volumePerMonth} · {step.automationTag}
              </p>
            </div>
          ))}
        </div>
      </details>

      {isGuest && (
        <p className="hint" data-testid="onboarding-guest">
          Looking only.
        </p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link to="/">← Trianz P&C</Link>
      </p>
    </div>
  );
}
