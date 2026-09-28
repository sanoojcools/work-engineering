import { Link } from "react-router-dom";
import { useIsGuest } from "../lib/guestMode";
import { HRBP_SPEC } from "../lib/desks/hrbp";
import type { DeskStep } from "../lib/desks/types";
import { specialistById } from "../lib/trianzPc";

/** Plan 95 and 61.8 stay on Offer Desk Plan. This walk copies hrbp.ts
 * and does not print those two numbers. */
function stepHint(step: DeskStep): string {
  return [step.system, step.spoc, step.timePerCase, step.volumePerMonth, step.automationTag]
    .filter((part) => !part.includes("95") && !part.includes("61.8"))
    .join(" · ");
}

/** Sheet prefixes, in file order. Three lists — not one renumbered chain.
 * The handoffs array is empty; this page does not invent a handoff table. */
const LISTS: { key: "ob" | "off" | "gr"; prefix: string; title: string }[] = [
  { key: "ob", prefix: "OB-", title: "Onboarding involvement (OB-)" },
  { key: "off", prefix: "OFF-", title: "Offboarding involvement (OFF-)" },
  { key: "gr", prefix: "GR-", title: "Grievance (GR-)" },
];

function stepsWithPrefix(steps: DeskStep[], prefix: string): DeskStep[] {
  return steps.filter((step) => step.id.startsWith(prefix));
}

/** HRBP walk. Who runs the desk first. Thamizh and Rajitha's sheet steps
 * stay behind "Desk as sat", closed, in the sheet's own OB- / OFF- / GR-
 * lists. Hours are the sheet's ~30-50 hrs/mo line. Status stays
 * needs-follow-up. Looking only — this page does not mint a key. */
export default function DeskHrbp() {
  const spec = HRBP_SPEC;
  const boss = specialistById("hrbp").boss;
  const isGuest = useIsGuest();

  return (
    <div data-testid="hrbp-walk">
      <p className="hint" style={{ marginBottom: 4 }}>
        Trianz P&C · HRBP
      </p>
      <h2>{spec.name}</h2>
      <p className="lede">
        Who runs it comes first. The steps Thamizh and Rajitha sat are behind the fold.
      </p>

      <div className="card" data-testid="hrbp-who" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Who runs it</h3>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }} data-testid="hrbp-runners">
          Thamizh + Rajitha
        </p>
        <p style={{ fontSize: 14, margin: "0 0 6px" }} data-testid="hrbp-boss">
          Boss: {boss}
        </p>
        {spec.status === "needs_follow_up" && (
          <p style={{ fontSize: 14, margin: "0 0 10px" }} data-testid="hrbp-status">
            Needs follow-up
          </p>
        )}
        <p style={{ fontSize: 14, margin: 0 }} data-testid="hrbp-hours">
          {spec.totalEstimatedSavings}
        </p>
      </div>

      <details style={{ marginBottom: 20 }} data-testid="desk-as-sat">
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          Desk as sat (Thamizh + Rajitha)
        </summary>
        <p className="hint" style={{ marginTop: 8 }}>
          Source: {spec.interviewSource}. Sheet language, not a scrape.
        </p>
        {LISTS.map((list) => {
          const steps = stepsWithPrefix(spec.steps, list.prefix);
          return (
            <section key={list.key} data-testid={`hrbp-list-${list.key}`} style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 10 }}>{list.title}</h3>
              <div className="stack" style={{ gap: 14, marginBottom: 8 }}>
                {steps.map((step) => (
                  <div key={step.id} className="card" style={{ margin: 0 }} data-testid="hrbp-step">
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 24,
                          height: 24,
                          padding: "0 8px",
                          borderRadius: 12,
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
            </section>
          );
        })}
      </details>

      {isGuest && (
        <p className="hint" data-testid="hrbp-guest">
          Looking only.
        </p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link to="/">← Trianz P&C</Link>
      </p>
    </div>
  );
}
