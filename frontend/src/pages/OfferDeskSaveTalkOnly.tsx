import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { ensureSeatSession } from "../lib/offerDeskSeats";

type PersistResult = {
  accepted: boolean;
  saved_count: number;
  work_unit_count: number;
  gqs: number;
  reasons: string[];
  talk_only: boolean;
  sheet_attached: boolean;
  provenance: string;
  ratification_accepted: boolean;
  zwayam_events_claimed: number;
  version_id: number;
  sequence: number;
};

export default function OfferDeskSaveTalkOnly() {
  const seat = useOfferDeskSeat("sme");
  const isGuest = useIsGuest();
  const [result, setResult] = useState<PersistResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetAttached, setSheetAttached] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSeatSession("sme");
      const body = await apiFetch.post<PersistResult>(
        `/scout/sessions/${session.id}/persist-talk-only`,
        { sheet_attached: sheetAttached },
      );
      setResult(body);
      await seat.retry();
    } catch (err) {
      if (err instanceof NeedsApiKeyError) {
        await seat.retry();
      } else {
        setError(err instanceof Error ? err.message : "Persist failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const denied = result && !result.accepted && result.saved_count === 0;

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · save talk-only
      </p>
      <h2>
        Can we save talk-only?{" "}
        <InfoTooltip
          term="Save"
          simple="Write into the company work list so later screens can use it. A finished conversation is still a conversation. Older name: persist."
        />
      </h2>
      <p className="lede">
        Completeness of Rashmi&apos;s sitting is not permission to save. This button calls the existing generate / GQS path.
      </p>
      <SeatStepper />
      <SeatSessionBar
        seat="sme"
        session={seat.session}
        needsKey={seat.needsKey}
        error={seat.error}
        busy={seat.busy}
        onRetry={seat.retry}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={sheetAttached}
            onChange={(e) => setSheetAttached(e.target.checked)}
          />
          Attach the spreadsheet as a declared note (still not Zwayam, still not observed)
        </label>
        {error && <div className="banner error">{error}</div>}
        <button
          type="button"
          className="primary"
          disabled={busy || seat.needsKey || !seat.session || seat.session.units.length === 0}
          onClick={() => void save()}
        >
          {busy ? "Calling the existing persist gate…" : "Save talk-only"}
        </button>
        {isGuest ? (
          <p className="hint">
            Sign in (Home → Set up the demo) to actually call this and see a real GQS score — it will still come back
            denied, saved_count 0, same as it does for a signed-in colleague. This button won't write anything without
            a key regardless.
          </p>
        ) : (
          seat.session && seat.session.units.length === 0 && (
            <p className="hint">The Offer Desk SME sitting has no rows yet. Open 3. Offer Desk SME first so the sheet language is captured.</p>
          )
        )}
      </div>

      {result && (
        <div className={`banner ${denied ? "warn" : "error"}`} style={{ marginBottom: 16 }}>
          <strong>{denied ? "Not saved." : "Unexpected persist result."}</strong>{" "}
          A finished conversation is not a company work list.
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Completeness on the sitting is not clearance. Evidence strength (GQS) {result.gqs.toFixed(1)} / 90.
            Saved work items: <strong>{result.saved_count}</strong>. Provenance: {result.provenance}.
            Zwayam events claimed: {result.zwayam_events_claimed}. Ratification accepted: {String(result.ratification_accepted)}.
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
            {result.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Why talk-only stays empty</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li>We only have what people said.</li>
          <li>The spreadsheet, even attached, is still a declared note — not traces.</li>
          <li>No Zwayam or Zoho history is attached either.</li>
          <li>Completeness only means Rashmi finished talking.</li>
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>What would clear this</h3>
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          Not one file — this gate is failing GQS because most of the sitting's Work Units are <code>declared</code>{" "}
          (an interview claim), not <code>observed</code> (backed by an uploaded, server-hashed system-of-record file:
          a Zwayam export, a Zoho signing log, a payroll report). Clearing it for real means uploading that whole
          evidence pack and importing a genome that cites it per-unit — one button here can't manufacture nine files
          Rashmi's interview never produced. <code>offer-desk-inputs/</code> is exactly that pack, fabricated for
          testing and proven to clear this same gate (GQS 92.73/90) — not wired into this screen, on purpose, so it's
          never mistaken for Rashmi's real production data.
        </p>
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          <Link to="/scout/offer-desk/evidence-pack">See it live, on a clearly separate genome →</Link>
        </p>
      </div>

      <IoPanes
        given="Three interviews, optional sheet as a note, no event log."
        understood="Talk is declared. Declared is not observed. Completeness is not clearance."
        processed="Save calls the existing generate / GQS path. Interviews alone will not clear the observed-weighted persist gate."
        output="Zero items written. Reasons you can read aloud."
      />

      <p style={{ marginTop: 20 }}>
        Next is the cut, not another save.{" "}
        <Link to="/scout/offer-desk/how-we-cut">How we cut it →</Link>
        {" · "}
        <Link to="/scout/offer-desk/playback">Back to Playback</Link>
      </p>
    </>
  );
}
