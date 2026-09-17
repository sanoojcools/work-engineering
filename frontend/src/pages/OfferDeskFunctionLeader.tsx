import { Link } from "react-router-dom";
import { InfoTooltip } from "../components/InfoTooltip";
import { ChroSitting } from "../components/offerDesk/ChroSitting";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { FacilitatorStrip } from "../components/scout/FacilitatorStrip";
import { FUNCTION_HEAD_INFO } from "../lib/sittingAnswers";
import { useWorkSystem } from "../lib/workSystem";

export default function OfferDeskFunctionLeader() {
  const seat = useOfferDeskSeat("function_head");
  const { workSystem, setWorkSystem } = useWorkSystem();
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · seat 1 of 3
      </p>
      <h2>
        Interview 1 · Function leader{" "}
        <InfoTooltip
          term={FUNCTION_HEAD_INFO.term}
          simple={FUNCTION_HEAD_INFO.simple}
          technical={FUNCTION_HEAD_INFO.technical}
        />
      </h2>
      <p className="lede">Start sitting. One question at a time. We play their words back as this period's line.</p>
      <SeatStepper />
      <SeatSessionBar
        seat="function_head"
        session={seat.session}
        needsKey={seat.needsKey}
        error={seat.error}
        busy={seat.busy}
        onRetry={seat.retry}
      />
      <FacilitatorStrip sessionId={seat.session?.id ?? null} />

      <ChroSitting
        sessionId={seat.session?.id ?? null}
        workSystem={workSystem}
        onWorkSystem={setWorkSystem}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/sub-function-lead">Next · 2. Sub-function lead →</Link>
      </p>
    </>
  );
}
