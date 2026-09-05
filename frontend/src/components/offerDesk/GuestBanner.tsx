import { Link } from "react-router-dom";
import { useIsGuest } from "../../lib/guestMode";

/** Shown on every V9 Offer Desk screen when this browser has no key that
 * resolves to a real tenant. The whole walk works without one; this just
 * says so, and points at Home for whoever does want to save. */
export function GuestBanner() {
  const isGuest = useIsGuest();
  if (!isGuest) return null;
  return (
    <div className="banner" style={{ marginBottom: 16, borderColor: "var(--line)" }}>
      <strong>Looking only — nothing is saved.</strong>{" "}
      <Link to="/">Set up the demo</Link> to save for real, or keep clicking through with no key.
    </div>
  );
}
