import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { ApiError } from "../api";
import {
  EVIDENCE_FILE_NAMES,
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
  const [stage, setStage] = useState<"idle" | "uploading" | "importing" | "done">("idle");
  const [progress, setProgress] = useState<{ fileName: string; done: number; total: number } | null>(null);
  const [uploaded, setUploaded] = useState<UploadedEvidenceFile[]>([]);
  const [result, setResult] = useState<GenomeImportResult | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
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
          term="Observed"
          simple="Backed by an uploaded, server-hashed file — a system log, not an interview claim. The opposite of declared."
        />
      </h2>
      <p className="lede">
        This is a different question from Save talk-only, on different data. Rashmi's real sitting is untouched —
        nothing on this page writes into it or changes its result. This imports a separate, clearly-labeled genome
        built from <code>offer-desk-inputs/</code>: nine invented candidates, invented Zwayam/Zoho/UAN/OneDrive exports,
        built to answer one question — if the observed-side evidence this platform is usually missing actually
        existed, would the pipeline work end to end?
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16, borderColor: "#b8860b" }}>
        <strong>Fabricated data, on purpose — not Rashmi's production month.</strong>
        <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>{packDisclaimer()}</p>
      </div>

      {needsKey && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13 }}>
          Button below uploads {EVIDENCE_FILE_NAMES.length} real files through the same{" "}
          <code>POST /files/upload</code> every genome import uses — server-computed sha256 per file, not
          caller-supplied — then imports an 11-Work-Unit genome citing those files as evidence for 9 of the 11 steps.
          The other 2 (welcome mail, candidate drop-out) have no log to back them in this batch and stay{" "}
          <code>declared</code>, not padded.
        </p>
        <button type="button" className="primary" disabled={stage === "uploading" || stage === "importing"} onClick={() => void run()}>
          {stage === "uploading"
            ? `Uploading ${progress?.fileName ?? ""} (${progress?.done ?? 0}/${progress?.total ?? EVIDENCE_FILE_NAMES.length})…`
            : stage === "importing"
              ? "Importing genome…"
              : stage === "done" && result
                ? "Run again"
                : "Load the evidence pack & import"}
        </button>
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
