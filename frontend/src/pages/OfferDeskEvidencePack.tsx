import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { ApiError } from "../api";
import {
  EVIDENCE_FILE_NAMES,
  SAMPLE_FABRICATED_LABEL,
  buildGenomePayload,
  packDisclaimer,
  uploadEvidencePack,
  type UploadedEvidenceFile,
} from "../lib/offerDeskEvidencePack";

type GenomeImportResult = {
  accepted: boolean;
  version_id: number | null;
  sequence: number | null;
  gqs: number;
  gate_threshold: number;
  breakdown: Record<string, number>;
  violations: Array<{ code: string; detail: string }>;
  work_unit_count: number;
};

export default function OfferDeskEvidencePack() {
  const isGuest = useIsGuest();
  const [stage, setStage] = useState<"idle" | "uploading" | "importing" | "done">("idle");
  const [progress, setProgress] = useState<{ fileName: string; done: number; total: number } | null>(null);
  const [uploaded, setUploaded] = useState<UploadedEvidenceFile[]>([]);
  const [result, setResult] = useState<GenomeImportResult | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    // POST /files/upload + POST /genome/import only. Never PUT sitting-answers
    // or field-ratifications — this pack is not a confirmed sitting.
    setError(null);
    setResult(null);
    setUploaded([]);
    try {
      setStage("uploading");
      const byOriginalFileId = await uploadEvidencePack((fileName, done, total) =>
        setProgress({ fileName, done, total }),
      );
      setUploaded(Array.from(byOriginalFileId.values()));

      setStage("importing");
      const payload = buildGenomePayload(byOriginalFileId);
      try {
        const body = await apiFetch.post<GenomeImportResult>("/genome/import", payload);
        setResult(body);
      } catch (err) {
        // import_genome_endpoint returns the SAME result shape as its 400
        // detail when GQS or a gate rejects the batch — not a different
        // error format, so a "denied" outcome here is still worth reading.
        if (err instanceof ApiError) {
          try {
            const parsed = JSON.parse(err.body) as { detail?: GenomeImportResult };
            if (parsed.detail) {
              setResult(parsed.detail);
              return;
            }
          } catch {
            /* fall through to generic error */
          }
        }
        throw err;
      }
    } catch (err) {
      if (err instanceof NeedsApiKeyError) {
        setNeedsKey(true);
      } else {
        setError(err instanceof Error ? err.message : "Could not load the evidence pack");
      }
    } finally {
      setStage("done");
    }
  }

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · with sample evidence
      </p>
      <h2>
        What if the evidence existed?{" "}
        <InfoTooltip
          term="Sample pack"
          simple="Invented files so a colleague can see the upload path. Not a sitting, and not traces from a live system."
          technical="offer-desk-inputs/ embedded in lib/offerDeskEvidencePack.json. POST /files/upload then POST /genome/import. Never PUT sitting-answers. Guest never uploads."
        />
      </h2>
      <p className="lede">
        This is a different question from Save talk-only, on different data. Rashmi's real sitting is untouched —
        nothing on this page writes into it or changes its result. This imports a separate, clearly-labelled genome
        built from <code>offer-desk-inputs/</code>: nine invented candidates, invented Zwayam/Zoho/UAN/OneDrive exports,
        built to answer one question — if the system-of-record files this platform is usually missing actually
        existed, would the pipeline work end to end?
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16, borderColor: "#b8860b" }} data-testid="sample-fabricated-label">
        <strong>{SAMPLE_FABRICATED_LABEL}</strong>
        <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
          Not Rashmi's production month, and not a real Zwayam, Zoho, or UAN connector. These are invented files for
          this build, not traces from a live system.
        </p>
        <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>{packDisclaimer()}</p>
      </div>

      {needsKey && !isGuest && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13 }}>
          Button below uploads {EVIDENCE_FILE_NAMES.length} real files through the same{" "}
          <code>POST /files/upload</code> every genome import uses — server-computed sha256 per file, not
          caller-supplied — then imports an 11-Work-Unit genome citing those files as evidence for 9 of the 11 steps.
          The other 2 (welcome mail, candidate drop-out) have no log to back them in this batch and stay{" "}
          <code>declared</code>, not padded.
        </p>
        {isGuest ? (
          <p className="hint" style={{ marginBottom: 0 }} data-testid="evidence-pack-guest">
            Looking only. Sign in (Home → Set up the demo) to upload — looking does not mint a key, and this pack is
            never saved as a confirmed sitting.
          </p>
        ) : (
          <button type="button" className="primary" disabled={stage === "uploading" || stage === "importing"} onClick={() => void run()}>
            {stage === "uploading"
              ? `Uploading ${progress?.fileName ?? ""} (${progress?.done ?? 0}/${progress?.total ?? EVIDENCE_FILE_NAMES.length})…`
              : stage === "importing"
                ? "Importing genome…"
                : stage === "done" && result
                  ? "Run again"
                  : "Load the evidence pack & import"}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{SAMPLE_FABRICATED_LABEL}</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Files in this pack. They are not on the Journey as extra hire pieces. Point at the file here.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} data-testid="evidence-pack-files">
          {EVIDENCE_FILE_NAMES.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>

      {uploaded.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Uploaded, for real</h3>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>File</th>
                <th>Server file_id</th>
                <th>sha256</th>
              </tr>
            </thead>
            <tbody>
              {uploaded.map((f) => (
                <tr key={f.file_id}>
                  <td>{f.file_name}</td>
                  <td>{f.file_id}</td>
                  <td>
                    <code>{f.sha256.slice(0, 16)}…</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div className={`banner ${result.accepted ? "ok" : "warn"}`} style={{ marginBottom: 16 }}>
          <strong>
            {result.accepted ? "Accepted." : "Not accepted."} GQS {result.gqs.toFixed(2)} / {result.gate_threshold}.
            {result.version_id ? ` Genome version ${result.version_id}, sequence ${result.sequence}.` : ""}
          </strong>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            {result.work_unit_count} Work Units on this version.
            {result.accepted
              ? " This is the same import pipeline and the same 90-point gate every genome faces — no relaxed path for this pack."
              : ""}
          </div>
          {result.violations.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {result.violations.map((v, i) => (
                <li key={i}>
                  {v.code}: {v.detail}
                </li>
              ))}
            </ul>
          )}
          {result.accepted && result.version_id && (
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              If you open this version's own Automation Index later and see a total-hours figure there (this exact
              pack computes ~72.2 hrs/mo), that is a different calculation — real VERDICT/cost-profile arithmetic over
              this fabricated evidence pack — from Rashmi's declared 95 or defended 61.8 on the Hours screen. Do not
              merge it into either number; it is not the same measurement.
            </p>
          )}
        </div>
      )}

      <IoPanes
        given="7 real system-of-record exports (invented content, real files) and an 11-unit genome citing them."
        understood="Observed provenance means a file backs the claim, not that the claim is true. These files are fabricated; the backing is real."
        processed="Same POST /files/upload, same POST /genome/import, same GQS>=90 gate as any other tenant's genome."
        output={
          result
            ? `GQS ${result.gqs.toFixed(2)} / ${result.gate_threshold} — ${result.accepted ? "accepted" : "denied"}, ${result.work_unit_count} Work Units.`
            : "Not run yet."
        }
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/save-talk-only">Back to Save talk-only</Link>
        {" · "}
        <Link to="/scout/offer-desk/sitting-record">Sitting record →</Link>
      </p>
    </>
  );
}
