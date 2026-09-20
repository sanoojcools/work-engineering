import { ChroSitting } from "../components/offerDesk/ChroSitting";
import { DesignedRoom } from "../components/offerDesk/DesignedRoom";
import { useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { FUNCTION_HEAD_INFO } from "../lib/sittingAnswers";
import { useWorkSystem } from "../lib/workSystem";

export default function OfferDeskFunctionLeader() {
  const seat = useOfferDeskSeat("function_head");
  const { workSystem, setWorkSystem } = useWorkSystem();
  return (
    <DesignedRoom
      seat="function_head"
      hook={seat}
      title="Function leader"
      lede="One question. Their sentence, or none yet."
      info={FUNCTION_HEAD_INFO}
      next={{ to: "/scout/offer-desk/sub-function-lead", label: "Next · 2. Sub-function lead →" }}
    >
      <ChroSitting
        sessionId={seat.session?.id ?? null}
        workSystem={workSystem}
        onWorkSystem={setWorkSystem}
      />
    </DesignedRoom>
  );
}
