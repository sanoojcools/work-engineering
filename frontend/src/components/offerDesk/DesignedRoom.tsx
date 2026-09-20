import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { InfoTooltip } from "../InfoTooltip";
import { SeatSessionBar, type OfferDeskSeatHook } from "./SeatSessionBar";
import { SeatStepper } from "./SeatStepper";
import type { OfferDeskSeatKey } from "../../lib/offerDeskSeats";

/** One chrome for the three designed sitting rooms. Voice (Facilitator /
 * DiscoveryPartner speech, stand-in Q&A cards) stays off this wrapper. */

const SEAT_N: Record<OfferDeskSeatKey, 1 | 2 | 3> = {
  function_head: 1,
  sub_function_lead: 2,
  sme: 3,
};

export function DesignedRoom({
  seat,
  hook,
  title,
  lede,
  info,
  next,
  children,
}: {
  seat: OfferDeskSeatKey;
  hook: OfferDeskSeatHook;
  title: string;
  lede: string;
  info?: { term: string; simple: string; technical?: string };
  next: { to: string; label: string; testId?: string };
  children: ReactNode;
}) {
  return (
    <div data-testid="designed-room" data-seat={seat}>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · seat {SEAT_N[seat]} of 3
      </p>
      <h2>
        {title}
        {info && (
          <>
            {" "}
            <InfoTooltip term={info.term} simple={info.simple} technical={info.technical} />
          </>
        )}
      </h2>
      <p className="lede">{lede}</p>
      <SeatStepper />
      <SeatSessionBar
        seat={seat}
        session={hook.session}
        needsKey={hook.needsKey}
        error={hook.error}
        busy={hook.busy}
        onRetry={hook.retry}
      />
      {children}
      <p style={{ marginTop: 20 }}>
        <Link to={next.to} data-testid={next.testId}>
          {next.label}
        </Link>
      </p>
    </div>
  );
}
