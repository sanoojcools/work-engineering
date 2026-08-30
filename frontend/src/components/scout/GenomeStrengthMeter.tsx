import type { ScoutSession } from "../../types";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function GenomeStrengthMeter({ session }: { session: ScoutSession }) {
  const pct = session.completeness_pct;
  const offset = CIRCUMFERENCE - (Math.min(pct, 100) / 100) * CIRCUMFERENCE;
  const weakest = [...session.dimensions]
    .filter((d) => d.computed)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  return (
    <div className="card">
      <h3>Genome Strength</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="10" />
          <circle
            cx="56"
            cy="56"
            r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 56 56)"
          />
          <text x="56" y="52" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--ink)">
            {pct.toFixed(0)}%
          </text>
          <text x="56" y="70" textAnchor="middle" fontSize="10" fill="var(--muted)">
            complete
          </text>
        </svg>
        <div className="muted" style={{ fontSize: 13 }}>
          {pct >= 100
            ? "Genome strength is at 100% — see the future preview when it ships."
            : `${(100 - pct).toFixed(0)} points to go. Averaged across the 7 dimensions Scout can measure today.`}
        </div>
      </div>

      <div className="stack">
        {session.dimensions.map((d) => (
          <div key={d.key}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
              <span>{d.label}</span>
              <span className="muted">
                {d.computed ? `${d.captured}/${d.expected} · ${d.pct.toFixed(0)}%` : "not tracked yet"}
              </span>
            </div>
            <div className="fn-progress">
              <span
                style={{
                  width: `${d.computed ? d.pct : 0}%`,
                  background: !d.computed
                    ? "var(--line)"
                    : d.pct < 50
                      ? "var(--danger)"
                      : d.pct < 100
                        ? "#8a6d2f"
                        : "var(--accent)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {weakest.length > 0 && pct < 100 && (
        <div className="nudge info" style={{ marginTop: 14, marginBottom: 0 }}>
          <div className="nudge-body">
            <div className="nudge-title">What gets me to 100%?</div>
            <div className="nudge-msg" style={{ marginBottom: 0 }}>
              Weakest dimensions right now: {weakest.map((d) => d.label).join(", ")}. Add or fill out a few more
              rows in the Work Capture Grid covering those fields.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
