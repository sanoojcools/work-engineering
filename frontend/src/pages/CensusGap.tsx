import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { GAP_ROWS } from "../lib/offerDeskWorkRecord";
import { useApi } from "../hooks";
import { useCompany } from "../company";
import { useIsGuest } from "../lib/guestMode";
import { withClient } from "../lib/withClient";
import type { Gap, Page } from "../types";

/** CENSUS-v0 Part A, step 4: Gap. A thin shell over the existing Gap page
 * (OfferDeskGap.tsx) and its data -- no second gap-detection mechanism.
 * Guest sees the same four illustrative rows that page shows; keyed sees a
 * real count read from the same GET /discovery/gaps this tenant's own
 * genome imports already populate. */
export default function CensusGap() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const { data, loading, error } = useApi<Page<Gap>>(
    isGuest ? null : withClient("/discovery/gaps", keyClientId),
  );

  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Gap <InfoTooltip term="Gap" simple="What upstairs named versus what the sitting described. The disagreement is the finding, not a defect to hide." />
      </h2>
      <p className="lede">
        Playback keeps three columns. This step names the disagreement between them — it does not vote them into one
        story.
      </p>

      {isGuest ? (
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Declared</th>
                <th>Sitting</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              {GAP_ROWS.map((row) => (
                <tr key={row.topic}>
                  <td>{row.topic}</td>
                  <td>{row.declared}</td>
                  <td>{row.sitting}</td>
                  <td>{row.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : loading ? (
        <p className="hint">Loading real conformance gaps for this tenant…</p>
      ) : error ? (
        <div className="banner error">{error}</div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>{data?.total ?? 0} conformance gap(s) on file for this tenant.</strong>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
            Read from this tenant's own genome imports (Gates 6, 9, 10 — advisory, never blocking). The full
            breakdown, with what each kind means and what this sitting structurally cannot see, is on the Gap page.
          </p>
        </div>
      )}

      <p style={{ marginBottom: 16 }}>
        <Link to="/scout/offer-desk/gap">Open the full Gap page →</Link>
      </p>

      <IoPanes
        given="Evidence: what's been uploaded or checked so far."
        understood="Declared upstairs is not the same record as declared at the desk."
        processed="Reads the same GET /discovery/gaps and the same four illustrative rows the existing Gap page uses — no second detector, no new store."
        output={isGuest ? "Four named gaps (guest, illustrative)." : `${data?.total ?? 0} real gap(s) for this tenant.`}
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/evidence">← Evidence</Link>
        <Link to="/census/chart">Next: Work Chart →</Link>
      </p>
    </>
  );
}
