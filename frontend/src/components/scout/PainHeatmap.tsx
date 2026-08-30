import { useEffect, useState } from "react";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";

type SystemRow = {
  system: string;
  time_wasted_min_per_day: number;
  unit_count: number;
  copy_paste_count: number;
  avg_pain_score: number;
  automation_potential_pct: number;
  unit_names: string[];
};

type Heatmap = { systems: SystemRow[]; top_pain_points: SystemRow[]; total_time_wasted_min_per_day: number };

function heat(score: number): string {
  if (score >= 3) return "#8a2f2f";
  if (score >= 1.5) return "#b56a2f";
  if (score > 0) return "#c9a227";
  return "var(--line)";
}

export function PainHeatmap({ sessionId, onNeedsKey }: { sessionId: number; onNeedsKey: () => void }) {
  const [data, setData] = useState<Heatmap | null>(null);

  useEffect(() => {
    apiFetch
      .get<Heatmap>(`/scout/sessions/${sessionId}/pain-heatmap`)
      .then(setData)
      .catch((err) => {
        if (err instanceof NeedsApiKeyError) onNeedsKey();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!data) return <p className="health">Loading pain heatmap…</p>;

  if (data.systems.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        No systems named yet — fill in the Systems column in the Work Capture Grid to see where time and pain
        concentrate.
      </p>
    );
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Pain score is a keyword count over what was said ("manual", "copy/paste", "painful"…) — not sentiment
        analysis, no model involved. Automation potential is each system's share of total daily minutes captured.
      </p>
      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table>
          <thead>
            <tr>
              <th>System</th><th>Units</th><th>Min/day</th><th>Copy/paste mentions</th>
              <th>Pain</th><th>Automation potential</th>
            </tr>
          </thead>
          <tbody>
            {data.systems
              .slice()
              .sort((a, b) => b.time_wasted_min_per_day - a.time_wasted_min_per_day)
              .map((r) => (
                <tr key={r.system}>
                  <td>{r.system}</td>
                  <td>{r.unit_count}</td>
                  <td>{r.time_wasted_min_per_day}</td>
                  <td>{r.copy_paste_count}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-block", width: 10, height: 10, background: heat(r.avg_pain_score),
                        marginRight: 6, verticalAlign: "middle",
                      }}
                    />
                    {r.avg_pain_score}
                  </td>
                  <td>{r.automation_potential_pct}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="nudge info" style={{ marginBottom: 0 }}>
        <div className="nudge-body">
          <div className="nudge-title">Top pain points</div>
          <div className="nudge-msg" style={{ marginBottom: 0 }}>
            {data.top_pain_points.map((r) => `${r.system} (${r.time_wasted_min_per_day} min/day)`).join(", ")}
          </div>
        </div>
      </div>
    </div>
  );
}
