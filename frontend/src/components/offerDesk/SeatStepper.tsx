import { NavLink } from "react-router-dom";
import { OFFER_DESK_SEAT_PATHS } from "../../lib/offerDeskSeats";
import { GuestBanner } from "./GuestBanner";

export function SeatStepper() {
  return (
    <>
      <GuestBanner />
      <div className="toolbar" style={{ marginBottom: 16 }}>
        {OFFER_DESK_SEAT_PATHS.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            style={({ isActive }) =>
              isActive
                ? { borderColor: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600 }
                : undefined
            }
          >
            {s.label}
          </NavLink>
        ))}
      </div>
    </>
  );
}
