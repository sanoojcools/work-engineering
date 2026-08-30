import { useEffect, useState } from "react";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";

type Timeline = {
  day_start_min: number;
  day_end_min: number;
  blocks: { unit_id: number; unit_name: string; start_min: number; end_min: number; minutes: number }[];
  gaps: { start_min: number; end_min: number; minutes: number }[];
  total_minutes: number;
  over_allocated: boolean;
  unplaced_units: { unit_id: number; unit_name: string; reason: string }[];
};

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const COLORS = ["#1f4e79", "#3d7ab5", "#6ba0d0", "#8a6d2f", "#2f8a5f", "#8a2f6d"];

export function TimeTravelReplay({ sessionId, onNeedsKey }: { sessionId: number; onNeedsKey: () => void }) {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const t = await apiFetch.get<Timeline>(`/scout/sessions/${sessionId}/timeline`);
      setTimeline(t);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function rebuild() {
    setBusy(true);
    try {
      const t = await apiFetch.post<Timeline>(`/scout/sessions/${sessionId}/timeline/rebuild`);
      setTimeline(t);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
    }
  }

  if (!timeline) return <p className="health">Loading timeline…</p>;

  const span = timeline.day_end_min - timeline.day_start_min;
  const pct = (min: number) => ((min - timeline.day_start_min) / span) * 100;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {fmt(timeline.day_start_min)} – {fmt(timeline.day_end_min)} · placed deterministically from each unit's
          frequency + time — no AI guessing what happened, just arithmetic.
        </p>
        <button type="button" disabled={busy} onClick={rebuild}>
          Rebuild from grid
        </button>
      </div>

      {timeline.over_allocated && (
        <div className="banner warn" style={{ marginBottom: 10 }}>
          You have {(timeline.total_minutes / 60).toFixed(1)}hrs of daily work in an {(span / 60).toFixed(0)}hr day —
          some of this must happen in parallel or on a different cadence than stated.
        </div>
      )}

      <div style={{ position: "relative", height: 48, background: "var(--bg)", border: "1px solid var(--line)", marginBottom: 10 }}>
        {timeline.blocks.map((b, i) => (
          <div
            key={b.unit_id}
            title={`${b.unit_name}: ${fmt(b.start_min)}–${fmt(b.end_min)}`}
            style={{
              position: "absolute",
              left: `${Math.max(0, pct(b.start_min))}%`,
              width: `${Math.max(0.5, pct(b.end_min) - pct(b.start_min))}%`,
              top: 4, bottom: 4,
              background: COLORS[i % COLORS.length],
              color: "#fff",
              fontSize: 11,
              overflow: "hidden",
              whiteSpace: "nowrap",
              padding: "2px 4px",
            }}
          >
            {b.unit_name}
          </div>
        ))}
        {timeline.gaps.map((g, i) => (
          <div
            key={i}
            title={`Gap: ${fmt(g.start_min)}–${fmt(g.end_min)} (${g.minutes} min) — what fills this?`}
            style={{
              position: "absolute",
              left: `${pct(g.start_min)}%`,
              width: `${pct(g.end_min) - pct(g.start_min)}%`,
              top: 4, bottom: 4,
              background: "repeating-linear-gradient(45deg, #f7f1e4, #f7f1e4 6px, #efe6cf 6px, #efe6cf 12px)",
              border: "1px dashed #8a6d2f",
            }}
          />
        ))}
      </div>

      {timeline.gaps.length > 0 && (
        <p className="hint" style={{ marginBottom: 10 }}>
          {timeline.gaps.length} gap{timeline.gaps.length > 1 ? "s" : ""} found (striped) — e.g. {fmt(timeline.gaps[0].start_min)}–
          {fmt(timeline.gaps[0].end_min)}, {timeline.gaps[0].minutes} min. What fills it? Add a row to the Work Capture
          Grid above.
        </p>
      )}

      {timeline.unplaced_units.length > 0 && (
        <p className="hint">
          Not placed (missing time or frequency): {timeline.unplaced_units.map((u) => u.unit_name).join(", ")}.
        </p>
      )}
    </div>
  );
}
