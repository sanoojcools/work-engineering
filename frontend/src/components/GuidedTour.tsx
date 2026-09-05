import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TOUR_STEPS } from "../lib/tourSteps";

const V9_ROUTE_PREFIXES = ["/enterprise", "/hr", "/scout/offer-desk"];

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!localStorage.getItem("tour_dismissed")) setOpen(true);
  }, []);

  // This tour's own steps target the pre-V9 walk (Overview -> Work Units ->
  // Discovery -> Projections), one page at a time with a "Step X of Y"
  // counter -- exactly the progress-pill confusion the V9 walk (its own
  // SeatStepper) must not carry. Home ("/") is V9's front door now too, not
  // this tour's step 1, so it's covered by the prefix list, not a bare "/".
  const onV9Route = location.pathname === "/" || V9_ROUTE_PREFIXES.some((p) => location.pathname.startsWith(p));
  if (onV9Route) return null;

  if (!open) {
    return (
      <button type="button" className="tour-fab" onClick={() => setOpen(true)}>
        Help / Tour
      </button>
    );
  }

  const step = TOUR_STEPS[stepIdx];

  return (
    <div className="tour-card">
      <div className="tour-head">
        <span>
          Step {stepIdx + 1} of {TOUR_STEPS.length} · {step.page}
        </span>
        <button
          type="button"
          className="nudge-x"
          onClick={() => {
            setOpen(false);
            localStorage.setItem("tour_dismissed", "1");
          }}
        >
          x
        </button>
      </div>
      <div className="tour-title">{step.title}</div>
      <div className="tour-msg">{step.message}</div>
      <div className="toolbar">
        {stepIdx > 0 && (
          <button type="button" onClick={() => setStepIdx((s) => s - 1)}>
            Back
          </button>
        )}
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (stepIdx < TOUR_STEPS.length - 1) {
              const next = TOUR_STEPS[stepIdx + 1];
              nav(next.page);
              setStepIdx((s) => s + 1);
            } else {
              setOpen(false);
              localStorage.setItem("tour_dismissed", "1");
            }
          }}
        >
          {step.nextLabel}
        </button>
      </div>
    </div>
  );
}
