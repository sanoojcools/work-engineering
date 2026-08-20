import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOUR_STEPS } from "../lib/tourSteps";

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("tour_dismissed")) setOpen(true);
  }, []);

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
