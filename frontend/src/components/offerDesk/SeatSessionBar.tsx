import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiKeyBanner } from "../ApiKeyBanner";
import { NeedsApiKeyError } from "../../lib/apiFetch";
import { useIsGuest } from "../../lib/guestMode";
import { OFFER_DESK_SEATS, ensureSeatSession, type OfferDeskSeatKey } from "../../lib/offerDeskSeats";
import { INTERVIEW_TYPE_LABELS } from "../../types";
import type { ScoutSession } from "../../types";

export function useOfferDeskSeat(seat: OfferDeskSeatKey) {
  const [session, setSession] = useState<ScoutSession | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await ensureSeatSession(seat);
      setSession(s);
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Failed to open sitting");
    } finally {
      setBusy(false);
    }
  }, [seat]);

  useEffect(() => {
    void load();
  }, [load]);

  return { session, needsKey, error, busy, retry: load };
}

export function SeatSessionBar({ seat, session, needsKey, error, busy, onRetry, showKeyBanner = true }: {
  seat: OfferDeskSeatKey;
  session: ScoutSession | null;
  needsKey: boolean;
  error: string | null;
  busy: boolean;
  onRetry: () => void;
  showKeyBanner?: boolean;
}) {
  const spec = OFFER_DESK_SEATS[seat];
  const isGuest = useIsGuest();
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
            Scout session · {INTERVIEW_TYPE_LABELS[spec.type]}
          </div>
          <p style={{ fontSize: 13, margin: 0 }}>
            {spec.interviewee_name}
            {spec.standIn ? " — labelled stand-in. No units invented for this seat." : " — real Offer Desk rows."}
          </p>
        </div>
        {session && (
          <Link to={`/scout/interview/${session.id}`}>
            Open sitting #{session.id} on the capture grid →
          </Link>
        )}
      </div>
      {busy && !session && <p className="hint">Opening the {INTERVIEW_TYPE_LABELS[spec.type]} sitting…</p>}
      {needsKey && isGuest && (
        <p className="hint" style={{ marginBottom: 0 }}>
          The rows below are the sheet language, shown without a live capture grid. Sign in (Home → Set up the demo)
          to open a real one.
        </p>
      )}
      {showKeyBanner && needsKey && !isGuest && <ApiKeyBanner onSaved={onRetry} />}
      {error && <div className="banner error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
    </div>
  );
}
