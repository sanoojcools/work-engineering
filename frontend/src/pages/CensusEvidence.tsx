import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";

/** CENSUS-v0 Part A, step 3: Evidence. Links to the existing upload /
 * document-check surfaces -- no new evidence store. Every upload on this
 * walk already goes through the same real POST /files/upload endpoint
 * (server-computed sha256); this page does not add a second one. */
export default function CensusEvidence() {
  const rec = DOCUMENT_CHECK_RECORD;
  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Evidence <InfoTooltip term="Evidence" simple="Proof a stranger could check, not a checker's say-so. Every upload on this walk goes through the same real file-hash endpoint -- there is no second, purpose-built evidence store." />
      </h2>
      <p className="lede">
        {rec.evidenceRequired} — the same document-check contract every genome import on this tenant faces. This
        step links to the existing upload and document-check screens; it does not open a new store.
      </p>

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Link to="/scout/offer-desk/document-check" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>Document check</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            The unit's current/desired condition, acceptance criteria, and evidence required — plus an optional real
            file upload showing its server-computed hash.
          </p>
        </Link>
        <Link to="/scout/offer-desk/evidence-pack" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3>With evidence (sample)</h3>
          <p className="hint" style={{ marginBottom: 0 }}>
            Uploads all 7 real files through <code>POST /files/upload</code> and imports the genome they back —
            the one path in this walk that actually clears the quality gate.
          </p>
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Spec deny → clear with evidence</h3>
        <p style={{ fontSize: 13, marginBottom: 10 }}>
          An empty evidence token denies by contract. Uploading a real file and re-asking Spec is the same idea, on
          the Spec screen itself.
        </p>
        <Link to="/scout/offer-desk/spec-deny">Ask Spec without a pass →</Link>
      </div>

      <IoPanes
        given="Capture: three seats, Offer Desk as the worked example."
        understood="A claim is not evidence. A file with a server-computed hash is."
        processed="Links only, to the existing document-check / evidence-pack / spec-deny screens — same POST /files/upload every one of them already uses, no new store."
        output="Evidence reachable in three places, all real, none duplicated here."
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/capture">← Capture</Link>
        <Link to="/census/gap">Next: Gap →</Link>
      </p>
    </>
  );
}
