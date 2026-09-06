import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { DOCUMENT_CHECK_RECORD, MISSING_DOC_STARTER, desiredConditionCheckability, step2 } from "../lib/offerDeskWorkRecord";

type UploadedEvidence = { file_id: string; sha256: string; file_name: string; size: number };

export default function OfferDeskDocumentCheck() {
  const rec = DOCUMENT_CHECK_RECORD;
  const sheet = step2();
  const isGuest = useIsGuest();
  const checkability = desiredConditionCheckability(rec);
  const [items, setItems] = useState<string[]>(MISSING_DOC_STARTER);
  const [draft, setDraft] = useState("");
  const [dualEmployment, setDualEmployment] = useState(true);
  const [uploaded, setUploaded] = useState<UploadedEvidence | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  function addItem() {
    const next = draft.trim();
    if (!next) return;
    setItems((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setDraft("");
  }

  async function uploadVerificationEvidence() {
    setUploading(true);
    setUploadError(null);
    try {
      const csv = "document_type,status\noffer_letter,verified\naadhaar,verified\npan_card,verified\n";
      const file = new File([csv], "document-check-verification.csv", { type: "text/csv" });
      const form = new FormData();
      form.append("file", file);
      const row = await apiFetch.postForm<UploadedEvidence>("/files/upload", form);
      setUploaded(row);
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) {
        setNeedsKey(true);
      } else {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · helper list · local only
      </p>
      <h2>
        Document check{" "}
        <InfoTooltip
          term="Helper"
          simple="A helper may draft a missing-document list. It may not release the offer. Dual employment is a stop. Appetite does not lift it."
        />
      </h2>
      <p className="lede">
        {sheet.timePerCase} of the day on the sheet. Helper drafts the list. Release stays disabled.
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          {rec.name}{" "}
          <InfoTooltip
            term="Work Unit shape"
            simple="Document check is shaped like a Work Unit -- a current condition, a desired condition, acceptance criteria, evidence required -- even though it is never saved as one. Same fields, no persisted row."
          />
        </h3>
        <dl className="story-fields graph-detail-grid">
          <dt>
            Current condition{" "}
            <InfoTooltip term="Current condition" simple="What must be true before this check can start." />
          </dt>
          <dd>{rec.currentCondition}</dd>

          <dt>
            Desired condition{" "}
            <InfoTooltip term="Desired condition" simple="What must be true when the check is done -- the definition of done." />
          </dt>
          <dd>{rec.desiredCondition}</dd>

          <dt>
            Acceptance criteria{" "}
            <InfoTooltip term="Acceptance criteria" simple="The rules that separate accepted from blocked, in the checker's own words -- not a paraphrase." />
          </dt>
          <dd>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {rec.acceptanceCriteria.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </dd>

          <dt>
            Evidence required{" "}
            <InfoTooltip term="Evidence required" simple="The proof a checker points to. Not the checker's say-so." />
          </dt>
          <dd>{rec.evidenceRequired}</dd>

          <dt>
            Dual employment{" "}
            <InfoTooltip
              term="Dual employment = stop"
              simple="A policy stop, not a missing document. No evidence and no appetite lifts it -- the offer does not release."
            />
          </dt>
          <dd>{rec.stopRule}</dd>
        </dl>
        <div className={`banner ${checkability.checkable ? "ok" : "warn"}`} style={{ marginTop: 12, marginBottom: 0 }}>
          <strong>{checkability.checkable ? "Checkable today." : "Warning: not checkable yet."}</strong>{" "}
          <span style={{ fontSize: 13 }}>{checkability.reason}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={dualEmployment}
            onChange={(e) => setDualEmployment(e.target.checked)}
          />
          Dual employment flagged on UAN — stop rule on
        </label>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a missing document"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <button type="button" onClick={addItem}>Add to helper list</button>
        </div>
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }}>
          {items.map((item) => (
            <li key={item}>
              {item}{" "}
              <button
                type="button"
                style={{ padding: "0 6px", fontSize: 12 }}
                onClick={() => setItems((prev) => prev.filter((x) => x !== item))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="primary" disabled>
          Release offer — disabled
        </button>
        <p className="hint" style={{ marginBottom: 0 }}>
          {dualEmployment
            ? rec.stopRule
            : "Stop rule off for this click only. The workbook still names dual employment as a stop. The button stays disabled either way — this screen does not release offers."}
          {" "}List is local React state. It is not evidence_ref. It is not a Work Unit.
          {isGuest ? " Guest: educational only, nothing here is ever sent to the server." : ""}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Verification spec{" "}
          <InfoTooltip
            term="Verification spec"
            simple="How this check would get confirmed, and by whom -- separate from doing the check itself."
          />
        </h3>
        <dl className="story-fields graph-detail-grid">
          <dt>
            Method{" "}
            <InfoTooltip
              term="Human spot check"
              simple="A person reviews the result. Not a machine rule, not a second system checking automatically -- someone looks."
              technical="verification_method = human_spot_check"
            />
          </dt>
          <dd>{rec.verificationMethod.replace(/_/g, " ")}</dd>

          <dt>
            Independent checker{" "}
            <InfoTooltip
              term="Independent checker"
              simple="Someone other than the person who did the work confirms it. The same person checking their own list can't catch their own blind spots."
              technical="Human spot check is only medium independence, and only if it's a different person (Work-Engineering-V8.md, G3)."
            />
          </dt>
          <dd>
            {rec.independentChecker.label}
            <div className="hint" style={{ marginTop: 4, marginBottom: 0 }}>{rec.independentChecker.detail}</div>
          </dd>

          <dt>File hash</dt>
          <dd>
            {uploaded ? (
              <>
                Uploaded <strong>{uploaded.file_name}</strong> ({uploaded.size} bytes) — server-computed{" "}
                <code>sha256 {uploaded.sha256.slice(0, 16)}…</code>
              </>
            ) : (
              "None uploaded on this screen yet."
            )}
          </dd>
        </dl>

        {!uploaded && (
          <div style={{ marginTop: 12 }}>
            {isGuest ? (
              <p className="hint" style={{ marginBottom: 0 }}>
                Sign in (Home → Set up the demo) to upload a real file here and see its server-computed hash.
              </p>
            ) : (
              <>
                {needsKey && <ApiKeyBanner onSaved={uploadVerificationEvidence} />}
                {uploadError && <div className="banner error">{uploadError}</div>}
                <button type="button" disabled={uploading} onClick={() => void uploadVerificationEvidence()}>
                  {uploading ? "Uploading…" : "Upload a sample file & show its hash"}
                </button>
                <p className="hint" style={{ marginBottom: 0 }}>
                  Optional. Uploads a small real CSV through the same <code>POST /files/upload</code> every genome
                  import uses — server-computed sha256, never typed in. This row stays empty until someone does.
                </p>
              </>
            )}
          </div>
        )}

        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          No promotion ladder here. Document check is never saved as a Work Unit on this walk, so it has no autonomy
          level to promote or demote — that ladder (VERDICT, G4) applies later, to a real, saved Work Unit.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>What would clear this</h3>
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          Nothing, on purpose — this screen has no evidence-upload button for the dual-employment stop itself, unlike
          Save talk-only or Spec deny. Dual employment isn't a missing document; it's a policy stop. A missing-document
          gate and a compliance stop look the same on screen (both disable release) but aren't the same kind of block
          — one is a data gap you close with a file, the other is a rule that no file is allowed to lift. Treating this
          like the other two would misrepresent a hard "no" as a data-completeness problem.
        </p>
      </div>

      <IoPanes
        given={`Sheet step ${rec.sheetStep} and the hire-type checklist language.`}
        understood="Missing documents are a list. Dual employment is a veto. Those are different."
        processed="Helper may draft the list in the browser. Release is not wired. No agent autonomy."
        output="A list you can edit. A disabled release. A stop that appetite does not lift."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/work-graph">Work Graph — 11 sequence edges →</Link>
      </p>
    </>
  );
}
