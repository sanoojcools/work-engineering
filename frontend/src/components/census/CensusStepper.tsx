import { useLocation, useNavigate } from "react-router-dom";
import { DownloadCensusButton } from "./DownloadCensusButton";

/** The Work Census shell's own six steps (docs/BUILD_PROGRAM.md CENSUS-v0
 * Part A) -- Home IS step 1, not a separate landing page ahead of it. Reuses
 * the same .progress/.pill CSS ProgressTracker.tsx already defined (same
 * "n of N" idiom), so this reads as one visual language, not a second
 * competing stepper -- but it is its own component with its own six steps:
 * ProgressTracker's pre-V9 "1 of 7" pills are hidden on every one of these
 * routes (see its own V9_ROUTE_PREFIXES / GuidedTour's copy of the same
 * list), so a visitor never sees two step counters at once. */
export const CENSUS_STEPS = [
  { path: "/", label: "1. Scope" },
  { path: "/census/capture", label: "2. Capture" },
  { path: "/census/evidence", label: "3. Evidence" },
  { path: "/census/gap", label: "4. Gap" },
  { path: "/census/chart", label: "5. Work Chart" },
  { path: "/census/plan", label: "6. Plan" },
] as const;

export function CensusStepper() {
  const loc = useLocation();
  const nav = useNavigate();
  const current = CENSUS_STEPS.findIndex((s) => s.path === loc.pathname);

  return (
    <div className="progress" style={{ marginBottom: 16 }}>
      {CENSUS_STEPS.map((s, i) => {
        const done = current >= 0 && i < current;
        const active = i === current;
        return (
          <div key={s.path} className="progress-step">
            <button
              type="button"
              className={done ? "pill done" : active ? "pill active" : "pill"}
              onClick={() => nav(s.path)}
            >
              {done ? "done · " : ""}
              {s.label}
            </button>
            {i < CENSUS_STEPS.length - 1 && <span className={done ? "progress-line done" : "progress-line"} />}
          </div>
        );
      })}
      <div className="progress-count">
        Work Census · {current < 0 ? "?" : current + 1} of {CENSUS_STEPS.length}
      </div>
      <DownloadCensusButton compact />
    </div>
  );
}
