import { useLocation, useNavigate } from "react-router-dom";

const STEPS = [
  { path: "/overview", label: "Overview" },
  { path: "/work-units", label: "Work Units" },
  { path: "/discovery", label: "Discovery" },
  { path: "/projections", label: "Projections" },
  { path: "/verdict", label: "VERDICT" },
  { path: "/economics", label: "Economics" },
  { path: "/work-graph", label: "Work Graph" },
];

// This walk's own steps, not V9's -- Home ("/") used to double as this
// tracker's "Overview" (step 1 of 7), which read as the current walk even
// on V9 routes that have nothing to do with it (V9's own progress lives in
// SeatStepper). V9_ROUTE_PREFIXES mirrors GuidedTour's list: any route this
// tracker has no real step for gets no pill bar, rather than defaulting to
// "1 of 7" on a page it was never about.
const V9_ROUTE_PREFIXES = ["/enterprise", "/hr", "/scout/offer-desk"];

export function ProgressTracker() {
  const loc = useLocation();
  const nav = useNavigate();
  const onV9Route = loc.pathname === "/" || V9_ROUTE_PREFIXES.some((p) => loc.pathname.startsWith(p));
  if (onV9Route) return null;

  const idx = STEPS.findIndex((s) => loc.pathname.startsWith(s.path));
  const current = idx < 0 ? 0 : idx;

  return (
    <div className="progress">
      {STEPS.map((s, i) => {
        const done = i < current;
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
            {i < STEPS.length - 1 && <span className={done ? "progress-line done" : "progress-line"} />}
          </div>
        );
      })}
      <div className="progress-count">
        {current + 1} of {STEPS.length}
      </div>
    </div>
  );
}
