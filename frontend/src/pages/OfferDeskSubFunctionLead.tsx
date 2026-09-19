import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { FacilitatorStrip } from "../components/scout/FacilitatorStrip";
import {
  OPS_ANSWER_IDS,
  OPS_QUESTION_COPY,
  SAMPLE_FIELD_LABEL,
  SAMPLE_OPS,
  SAMPLE_PACK_BANNER,
  isOpsSampleText,
  useDemoSampleOn,
  type OpsAnswerId,
} from "../lib/demoSampleSeats";
import { useIsGuest } from "../lib/guestMode";

export default function OfferDeskSubFunctionLead() {
  const seat = useOfferDeskSeat("sub_function_lead");
  const sampleOn = useDemoSampleOn();
  const isGuest = useIsGuest();
  const [answers, setAnswers] = useState(() => (sampleOn ? { ...SAMPLE_OPS } : emptyOps()));

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · seat 2 of 3
      </p>
      <h2>
        Interview 2 · Sub-function lead{" "}
        <InfoTooltip
          term="Stand-in"
          simple="Labelled until a real Head of HR operations sitting is recorded. Boundaries come from the Offer Desk handoff map, not from a quoted interview."
        />
      </h2>
      <p className="lede">
        How the desk is meant to run. Sample answers are from Rashmi&apos;s sheet, not a named Ops sitting.
      </p>
      <SeatStepper />
      <SeatSessionBar
        seat="sub_function_lead"
        session={seat.session}
        needsKey={seat.needsKey}
        error={seat.error}
        busy={seat.busy}
        onRetry={seat.retry}
      />
      <FacilitatorStrip sessionId={seat.session?.id ?? null} />

      {sampleOn && (
        <div className="banner info" data-testid="sample-pack-banner">
          {SAMPLE_PACK_BANNER}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }} data-testid="ops-sample-answers">
        <h3>Trigger, end, systems, cover</h3>
        <div className="stack" style={{ gap: 12 }}>
          {OPS_ANSWER_IDS.map((id) => (
            <OpsSampleField
              key={id}
              id={id}
              value={answers[id]}
              sampleOn={sampleOn}
              onChange={(value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
            />
          ))}
        </div>
        {isGuest && (
          <p className="hint" style={{ marginBottom: 0, marginTop: 12 }} data-testid="ops-guest">
            Looking only — this walk stored nothing.
          </p>
        )}
      </div>

      <IoPanes
        given="Handoff map and transition state rows from the sheet."
        understood="HR Ops is a chain of desks, not one queue. Offer Desk is not Onboarding."
        processed="Sample stays in this walk. We do not save it as a named Ops sitting. Darwinbox is named as coming, not arrived."
        output="A boundary: Offer Desk ends at handover. SPOC work is out of scope for this cut. Umesh covers when Rashmi is out."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/rashmi">Next · 3. Rashmi →</Link>
      </p>
    </>
  );
}

function emptyOps(): Record<OpsAnswerId, string> {
  return { ops_trigger: "", ops_end: "", ops_systems: "", ops_cover: "" };
}

function OpsSampleField({
  id,
  value,
  sampleOn,
  onChange,
}: {
  id: OpsAnswerId;
  value: string;
  sampleOn: boolean;
  onChange: (value: string) => void;
}) {
  const sample = sampleOn && isOpsSampleText(id, value);
  return (
    <div style={{ border: "1px solid var(--line)", padding: 12 }}>
      <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
        {OPS_QUESTION_COPY[id]}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{ width: "100%", boxSizing: "border-box", marginTop: 6 }}
        aria-label={OPS_QUESTION_COPY[id]}
        data-testid={`ops-answer-${id}`}
      />
      {sample && (
        <p className="hint" style={{ marginBottom: 0, marginTop: 6 }} data-testid={`sample-field-label-${id}`}>
          {SAMPLE_FIELD_LABEL}
        </p>
      )}
    </div>
  );
}
