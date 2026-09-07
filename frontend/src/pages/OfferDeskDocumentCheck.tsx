import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import { DOCUMENT_CHECK_RECORD, MISSING_DOC_STARTER, desiredConditionCheckability, step2 } from "../lib/offerDeskWorkRecord";
import { fieldProvenance, scenarioStrip } from "../lib/offerDeskScenarios";
import type { Page, Verdict, WorkUnit } from "../types";

type UploadedEvidence = { file_id: string; sha256: string; file_name: string; size: number };

// The evidence-pack genome's own code for this exact record (lib/offerDeskData.ts
// step 2 -> lib/offerDeskEvidencePack.json's WU-OD-02, "Verify candidate
// documents") -- the one real Work Unit code that IS Document check, once a
// genome has been imported for this tenant.
const DOCUMENT_CHECK_CODE = "WU-OD-02";

export default function OfferDeskDocumentCheck() {
  const rec = DOCUMENT_CHECK_RECORD;
  const sheet = step2();
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const checkability = desiredConditionCheckability(rec);

  // T3d-S / T3b-P: real VERDICT + real Work Unit data for WU-OD-02, if this
  // tenant has imported one. Guest never attempts the call, same idiom as
  // every other live read on this walk (OfferDeskWorkGraph.tsx).
  const unitsApi = useApi<Page<WorkUnit>>(isGuest ? null : withClient("/work-units/", keyClientId));
  const verdictsApi = useApi<Page<Verdict>>(isGuest ? null : withClient("/verdict/", keyClientId));
  const matchedUnit = (unitsApi.data?.items ?? []).find((u) => u.code === DOCUMENT_CHECK_CODE) ?? null;
  const matchedVerdict = matchedUnit
    ? (verdictsApi.data?.items ?? []).find((v) => v.work_unit_id === matchedUnit.id) ?? null
    : null;
  const scenario = scenarioStrip(matchedVerdict);
  const provenance = fieldProvenance(matchedUnit);
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
          Allocation scenarios{" "}
          <InfoTooltip
            term="S1 / S2 / S3"
            simple="Three what-ifs on one real VERDICT score: S1 is the floor if this record's weakest scored property dominated, S2 is what VERDICT derives today, S3 is the ceiling if its strongest property dominated. All three still obey the same hard gates — a ceiling cannot outrun evidence or compliance."
            technical="Replays verdict.py's base_level()/apply_hard_gates() against min/mean/max of the same seven real property scores (frontend/src/lib/offerDeskScenarios.ts) — not a second scoring engine, and not a fabricated number."
          />
        </h3>
        {isGuest ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            Guest: this reads a real, signed-in tenant's VERDICT score — not fabricated for guest viewing.
          </p>
        ) : !scenario.scored ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            {matchedUnit ? (
              <>
                Not scored — {DOCUMENT_CHECK_CODE} exists but no VERDICT score has been recorded for it yet.{" "}
                <Link to="/verdict">Score it on the Verdict page →</Link>
              </>
            ) : (
              <>
                Not scored — no real Work Unit exists for this record yet.{" "}
                <Link to="/scout/offer-desk/evidence-pack">Import the evidence pack →</Link> to create {DOCUMENT_CHECK_CODE}.
              </>
            )}
          </p>
        ) : (
          <>
            <div className="metrics" style={{ marginBottom: 12 }}>
              <div className="metric">
                <div className="n">L{scenario.s1Floor.level}</div>
                <div className="l">S1 floor — {scenario.s1Floor.allocation}</div>
              </div>
              <div className="metric">
                <div className="n">L{scenario.s2Derived.level}</div>
                <div className="l">S2 derived — {scenario.s2Derived.allocation}</div>
              </div>
              <div className="metric">
                <div className="n">L{scenario.s3Ceiling.level}</div>
                <div className="l">S3 ceiling — {scenario.s3Ceiling.allocation}</div>
              </div>
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>
              {scenario.appliedGates.length > 0
                ? `Hard gates hold at every scenario (${scenario.appliedGates.join(", ")}) — S3 cannot rise past what they allow.`
                : "No VERDICT hard gate caps this unit today."}{" "}
              Appetite never lifts the dual-employment stop above, at any of the three — that stop is not part of
              VERDICT's own gates and nothing here wires around it. Release offer stays disabled regardless of S3.
            </p>
          </>
        )}
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
        <h3>
          Field provenance{" "}
          <InfoTooltip
            term="Field provenance"
            simple="How many of this record's contract attributes are actually filled in, and what real source they're attributed to — observed, declared, inferred, or designed. Not a hardcoded example count."
            technical="services/contract.py::missing_attributes' complement (16 of the 18 contract attributes — #15 dependencies and #17 regulatory register link are tracked separately, not scalar-checked there), attributed to this unit's own real WorkUnit.provenance value. One provenance value per unit today, not per field, so every other source-type bucket is a real, not padded, zero."
          />
        </h3>
        {isGuest ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            Guest: educational copy only — no fake counts from Client A. A signed-in tenant's real Work Unit is what
            this would count.
          </p>
        ) : !provenance.scored ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            Not scored — no real Work Unit exists for this record yet.{" "}
            <Link to="/scout/offer-desk/evidence-pack">Import the evidence pack →</Link> to create {DOCUMENT_CHECK_CODE}.
          </p>
        ) : (
          <>
            <div className="metrics" style={{ marginBottom: 12 }}>
              <div className="metric">
                <div className="n">{provenance.counts.observed}</div>
                <div className="l">Observed</div>
              </div>
              <div className="metric">
                <div className="n">{provenance.counts.declared}</div>
                <div className="l">Declared</div>
              </div>
              <div className="metric">
                <div className="n">{provenance.counts.inferred}</div>
                <div className="l">Inferred</div>
              </div>
              <div className="metric">
                <div className="n">{provenance.counts.designed}</div>
                <div className="l">Designed</div>
              </div>
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>
              {provenance.notYetProvided.length === 0
                ? `All ${provenance.checkedAttributeCount} checked attributes are provided.`
                : `${provenance.notYetProvided.length} of ${provenance.checkedAttributeCount} checked attributes not yet provided: ${provenance.notYetProvided.join(", ")}.`}{" "}
              #15 dependencies and #17 regulatory register link are tracked separately (Work Graph, regulatory entry),
              not counted here.
            </p>
          </>
        )}
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
        given={`Sheet step ${rec.sheetStep}, the hire-type checklist language, and — once imported — ${DOCUMENT_CHECK_CODE}'s real VERDICT score and contract fields.`}
        understood="Missing documents are a list. Dual employment is a veto. Those are different. Scenarios and provenance describe the record; neither one is a release switch."
        processed="Helper may draft the list in the browser. Release is not wired. No agent autonomy. S1/S2/S3 replay VERDICT's own gate math; field provenance reads real contract completeness — both read-only, both 'not scored' when no real data exists."
        output="A list you can edit. A disabled release. A stop that appetite does not lift, at any scenario."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/work-graph">Work Graph — 11 sequence edges →</Link>
      </p>
    </>
  );
}
