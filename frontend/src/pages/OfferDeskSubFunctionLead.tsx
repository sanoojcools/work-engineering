import { useState } from "react";
import { DesignedRoom } from "../components/offerDesk/DesignedRoom";
import { SamplePackBanner } from "../components/offerDesk/SamplePackBanner";
import { useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import {
  OPS_ANSWER_IDS,
  SAMPLE_FIELD_LABEL,
  SAMPLE_OPS,
  isOpsSampleText,
  useDemoSampleOn,
  type OpsAnswerId,
} from "../lib/demoSampleSeats";
import { useIsGuest } from "../lib/guestMode";
import { OPS_EMPTY_SLOTS, OPS_HAS_NOT_SAT } from "../lib/offerDeskSeats";

export default function OfferDeskSubFunctionLead() {
  const seat = useOfferDeskSeat("sub_function_lead");
  const sampleOn = useDemoSampleOn();
  const isGuest = useIsGuest();
  const [answers, setAnswers] = useState(() => (sampleOn ? { ...SAMPLE_OPS } : emptyOps()));

  return (
    <DesignedRoom
      seat="sub_function_lead"
      hook={seat}
      title="Sub-function lead"
      lede={
        sampleOn
          ? "What starts the desk, what counts as done, and who covers. Sample is from Rashmi's sheet, not a named Ops sitting."
          : "What starts the desk, what counts as done, and who covers. Empty until Ops sits."
      }
      info={{
        term: "sub_function_lead",
        simple: "The person who runs the desks sits here. Sample, if shown, is labelled and is not a named sitting.",
        technical:
          "Scout session type=sub_function_lead. Designed empty: trigger / end / cover. Sample prefill is client-only and is never PUT. Persist of sitting-answers on this seat is a later slice. Guest never PUT/POST.",
      }}
      next={{ to: "/scout/offer-desk/rashmi", label: "Next · 3. Rashmi →" }}
    >
      {sampleOn && <SamplePackBanner />}
      <div className="card" style={{ marginBottom: 16 }} data-testid={sampleOn ? "ops-sample-answers" : "ops-empty"}>
        {!sampleOn && (
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }} data-testid="ops-has-not-sat">
            {OPS_HAS_NOT_SAT}
          </p>
        )}
        <div className="stack" style={{ gap: 12 }}>
          {OPS_EMPTY_SLOTS.map((slot) => {
            const id = slot.id as OpsAnswerId;
            const value = answers[id];
            const sample = sampleOn && isOpsSampleText(id, value);
            return (
              <div key={slot.label} style={{ border: "1px solid var(--line)", padding: 12 }}>
                <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
                  {slot.label}
                </div>
                {sampleOn ? (
                  <>
                    <textarea
                      value={value}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [id]: e.target.value }))}
                      rows={3}
                      style={{ width: "100%", boxSizing: "border-box", marginTop: 6 }}
                      aria-label={slot.label}
                      data-testid={`ops-slot-${slot.id}`}
                    />
                    {sample && (
                      <p className="hint" style={{ marginBottom: 0, marginTop: 6 }} data-testid={`sample-field-label-${id}`}>
                        {SAMPLE_FIELD_LABEL}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 14, margin: "6px 0 0" }} data-testid={`ops-slot-${slot.id}`}>
                    {OPS_HAS_NOT_SAT}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {sampleOn && isGuest && (
          <p className="hint" style={{ marginBottom: 0, marginTop: 12 }} data-testid="ops-guest">
            Looking only — this walk stored nothing.
          </p>
        )}
      </div>
    </DesignedRoom>
  );
}

function emptyOps(): Record<OpsAnswerId, string> {
  return Object.fromEntries(OPS_ANSWER_IDS.map((id) => [id, ""])) as Record<OpsAnswerId, string>;
}
