import { useLocation, useNavigate } from "react-router-dom";

const STEPS = [
  { path: "/", label: "Overview" },
  { path: "/ontology", label: "Ontology" },
  { path: "/work-units", label: "Work Units" },
  { path: "/verdict", label: "VERDICT" },
  { path: "/verification", label: "Verification" },
  { path: "/economics", label: "Economics" },
  { path: "/spec", label: "Spec API" },
  { path: "/projections", label: "Projections" },
];

export function ProgressTracker() {
  const loc = useLocation();
  const nav = useNavigate();
  const idx = STEPS.findIndex((s) => (s.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(s.path)));
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
