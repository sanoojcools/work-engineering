import { Link } from "react-router-dom";
import { useIsGuest } from "../lib/guestMode";
import { VENDOR_MGMT_SPEC } from "../lib/desks/vendorMgmt";
import type { DeskStep } from "../lib/desks/types";
import { specialistById } from "../lib/trianzPc";

/** Plan 95 and 61.8 stay on Offer Desk Plan. This walk copies the sheet
 * but does not print those two numbers — including the sheet's own 95-98
 * contractor counts, which would otherwise look like Plan 95. */
function stepHint(step: DeskStep): string {
  return [step.system, step.spoc, step.timePerCase, step.volumePerMonth, step.automationTag]
    .filter((part) => !part.includes("95") && !part.includes("61.8"))
    .join(" · ");
}

/** Vendor walk. Who runs the desk first. Reshma V's 14 sheet steps stay
 * behind "Desk as sat", closed. Hours are the sheet's own ~9 hrs/day line.
 * Status stays needs-follow-up. Looking only — this page does not mint a key. */
export default function DeskVendorMgmt() {
  const spec = VENDOR_MGMT_SPEC;
  const boss = specialistById("vendor").boss;
  const isGuest = useIsGuest();

  return (
    <div data-testid="vendor-walk">
      <p className="hint" style={{ marginBottom: 4 }}>
        Trianz P&C · Vendor
      </p>
      <h2>{spec.name}</h2>
      <p className="lede">
        Who runs it comes first. The steps Reshma V sat are behind the fold.
      </p>

      <div className="card" data-testid="vendor-who" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Who runs it</h3>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }} data-testid="vendor-runners">
          Reshma V
        </p>
        <p style={{ fontSize: 14, margin: "0 0 6px" }} data-testid="vendor-backup">
          Backup: {spec.backup}
        </p>
        <p style={{ fontSize: 14, margin: "0 0 6px" }} data-testid="vendor-boss">
          Boss: {boss}
        </p>
        {spec.status === "needs_follow_up" && (
          <p style={{ fontSize: 14, margin: "0 0 10px" }} data-testid="vendor-status">
            Needs follow-up
          </p>
        )}
        <p style={{ fontSize: 14, margin: 0 }} data-testid="vendor-hours">
          {spec.monthlyEffortProfile[0]}
        </p>
      </div>

      <details style={{ marginBottom: 20 }} data-testid="desk-as-sat">
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Desk as sat (Reshma V)</summary>
        <p className="hint" style={{ marginTop: 8 }}>
          Source: {spec.interviewSource}. Sheet language, not a scrape.
        </p>
        <h3>The {spec.steps.length} steps</h3>
        <div className="stack" style={{ gap: 14, marginBottom: 8 }}>
          {spec.steps.map((step) => (
            <div key={step.id} className="card" style={{ margin: 0 }} data-testid="vendor-step">
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
        <p className="hint" data-testid="vendor-guest">
          Looking only.
        </p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link to="/">← Trianz P&C</Link>
      </p>
    </div>
  );
}
