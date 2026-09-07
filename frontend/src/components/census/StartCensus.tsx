import { useState } from "react";
import { ApiKeyBanner } from "../ApiKeyBanner";
import { ReadinessStrip } from "./ReadinessStrip";
import { errorMessage } from "../../api";
import { NeedsApiKeyError } from "../../lib/apiFetch";
import { startOfferToOnboardingCensus, useCensus } from "../../lib/censuses";

/** Scope-only: Start census + readiness strip. Guest never hits the API and
 * never mints a key. Keyed Start POSTs get-or-create then /start; the row
 * and its started_at survive a refresh via GET /api/censuses. */
export function StartCensus() {
  const { isGuest, census, readiness, loading, error, needsKey, setNeedsKey, setCensus, setError } =
    useCensus();
  const [starting, setStarting] = useState(false);

  const source = isGuest ? "guest" : census ? "api" : "empty";

  async function onStart() {
    setStarting(true);
    setError(null);
    try {
      setCensus(await startOfferToOnboardingCensus());
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {needsKey && !isGuest && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}

      <ReadinessStrip readiness={readiness} source={source} />

      {isGuest ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <button type="button" className="primary" onClick={() => undefined} aria-label="Start census">
            Start census
          </button>
          <p className="hint" style={{ marginBottom: 0, marginTop: 10 }}>
            Looking only — nothing is saved. Start does not mint a key. Sign in (Set up the demo, below) to create a
            census record that survives a refresh.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          {loading && !census && <p className="hint">Loading this tenant's census…</p>}
          {census && census.status === "started" ? (
            <p style={{ margin: 0, fontSize: 13 }}>
              <span className="badge good">Census started</span>{" "}
              {census.started_at ? `at ${census.started_at}.` : ""} Persisted — survives a refresh.
            </p>
          ) : (
            <>
              <button
                type="button"
                className="primary"
                disabled={starting}
                onClick={() => void onStart()}
              >
                {starting ? "Starting…" : "Start census"}
              </button>
              <p className="hint" style={{ marginBottom: 0, marginTop: 10 }}>
                Creates a census record for this Offer → Day-1 journey. The record survives a refresh. Readiness above
                is then this tenant's real consent / three people / docs — still red where those are empty.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
