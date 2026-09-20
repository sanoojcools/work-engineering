import { DesignedRoom } from "../components/offerDesk/DesignedRoom";
import { useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { OPS_EMPTY_SLOTS, OPS_HAS_NOT_SAT } from "../lib/offerDeskSeats";

export default function OfferDeskSubFunctionLead() {
  const seat = useOfferDeskSeat("sub_function_lead");
  return (
    <DesignedRoom
      seat="sub_function_lead"
      hook={seat}
      title="Sub-function lead"
      lede="What starts the desk, what counts as done, and who covers. Empty until Ops sits."
      info={{
        term: "sub_function_lead",
        simple: "The person who runs the desks sits here. Until they do, this room stays empty — we do not fill it from a workbook.",
        technical:
          "Scout session type=sub_function_lead. Designed empty: trigger / end / cover. Persist of sitting-answers on this seat is a later slice. Guest never PUT/POST.",
      }}
      next={{ to: "/scout/offer-desk/rashmi", label: "Next · 3. Rashmi →" }}
    >
      <div className="card" style={{ marginBottom: 16 }} data-testid="ops-empty">
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }} data-testid="ops-has-not-sat">
          {OPS_HAS_NOT_SAT}
        </p>
        <div className="stack" style={{ gap: 12 }}>
          {OPS_EMPTY_SLOTS.map((slot) => (
            <div key={slot.label} style={{ border: "1px solid var(--line)", padding: 12 }}>
              <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
                {slot.label}
              </div>
              <p style={{ fontSize: 14, margin: "6px 0 0" }} data-testid={`ops-slot-${slot.id}`}>
                {OPS_HAS_NOT_SAT}
              </p>
            </div>
          ))}
        </div>
      </div>
    </DesignedRoom>
  );
}
