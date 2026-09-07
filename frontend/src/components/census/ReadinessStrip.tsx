import { InfoTooltip } from "../InfoTooltip";
import type { CensusReadiness } from "../../types";

/** Three honest rows from GET /api/censuses readiness — consent / three
 * people / docs. Green only when the matching boolean is true. Guest and
 * keyed-with-no-row both render EMPTY_READINESS (all red, counts zero);
 * docs never claims files were "received" — the boolean is "at least one
 * upload exists," the same existing table the backend already reads. */
function Row({
  label,
  ready,
  detail,
  infoTerm,
  infoSimple,
  infoTechnical,
}: {
  label: string;
  ready: boolean;
  detail: string;
  infoTerm: string;
  infoSimple: string;
  infoTechnical?: string;
}) {
  return (
    <div className="readiness-row" data-testid={`readiness-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className={`badge ${ready ? "good" : "bad"}`}>{ready ? "Ready" : "Not yet"}</span>
      <div>
        <strong>
          {label}{" "}
          <InfoTooltip term={infoTerm} simple={infoSimple} technical={infoTechnical} />
        </strong>
        <p className="hint" style={{ margin: "2px 0 0" }}>
          {detail}
        </p>
      </div>
    </div>
  );
}

export function ReadinessStrip({
  readiness,
  source,
}: {
  readiness: CensusReadiness;
  source: "guest" | "empty" | "api";
}) {
  const peopleTotal = readiness.people_seats_total || 3;
  const sourceLine =
    source === "guest"
      ? "Looking only — no tenant, so nothing here is saved. All three rows are empty on purpose, not a fabricated green."
      : source === "empty"
        ? "No census record yet. Start one to read this tenant's real consent, seats, and files — the strip stays empty until then."
        : "Read live from this tenant's existing consent receipts, three interview seats, and uploaded files — not a separate document-request workflow.";

  return (
    <div className="card" data-testid="census-readiness" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>
        Readiness{" "}
        <InfoTooltip
          term="Census readiness"
          simple="Three checks before this census is in a position to sit: someone consented, three people have sat (function leader, sub-function lead, SME), and at least one file has been uploaded. Red means that check is not true yet. Green means it is, from data this tenant already has — never a pretend 'documents received' tick."
          technical="GET /api/censuses → readiness. consent = ≥1 active consent_receipts row; people = all three scout_interview_sessions.type values present; docs = ≥1 uploaded_files row. Tenant-wide, not per-journey — none of those tables carries work_system_id."
        />
      </h3>
      <div className="readiness-strip">
        <Row
          label="Consent"
          ready={readiness.consent}
          detail={
            readiness.consent
              ? `${readiness.consent_receipt_count} active consent receipt${readiness.consent_receipt_count === 1 ? "" : "s"}.`
              : "No active consent receipt yet."
          }
          infoTerm="Consent"
          infoSimple="Someone has an active consent receipt on file for this tenant. Without it, the strip stays red — looking does not mint one."
        />
        <Row
          label="Three people"
          ready={readiness.people}
          detail={`${readiness.people_seats_filled} of ${peopleTotal} seats (function leader, sub-function lead, SME).`}
          infoTerm="Three people"
          infoSimple="All three seats have sat at least once: a function leader, a sub-function lead, and an SME. Three sittings of the same seat do not count as three people."
          infoTechnical="people is true only when scout_interview_sessions has function_head, sub_function_lead, and sme for this tenant."
        />
        <Row
          label="Docs"
          ready={readiness.docs}
          detail={
            readiness.docs
              ? `${readiness.docs_uploaded_count} file${readiness.docs_uploaded_count === 1 ? "" : "s"} uploaded.`
              : "No files uploaded yet — this is 'asked', not a claim that files were received."
          }
          infoTerm="Docs"
          infoSimple="At least one file this tenant actually uploaded. Not a document-request tracker, and not a tick for 'we asked'."
          infoTechnical="docs = uploaded_files count > 0 for this tenant. The censuses.document_requests column is unused opaque JSON — this UI does not invent a workflow around it."
        />
      </div>
      <p className="hint" style={{ marginBottom: 0, marginTop: 10 }}>
        {sourceLine}
      </p>
    </div>
  );
}
