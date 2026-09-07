import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";
import { REGISTERS, REGISTER_COPY, countRegisters, type GapRegister } from "../lib/gapRegisters";
import { useApi } from "../hooks";
import { useIsGuest } from "../lib/guestMode";
import { withClient } from "../lib/withClient";
import { useCompany } from "../company";
import type { Gap, Page, UploadedFileOut } from "../types";

/** Guest has no tenant, so these three counts replay the same four
 * illustrative declared-vs-sitting rows already used on Gap (GAP_ROWS in
 * offerDeskWorkRecord.ts) -- not a live query, not a second illustrative
 * set invented for this page. "What the work is" and "Document check" both
 * describe detail the sitting holds that the declared/upstairs sentence
 * never named (missing); "System of record" is a direct disagreement about
 * which system holds truth (contradictory); "Hours saved" is two numbers
 * for the same month with no single settled figure (uncertain). */
const GUEST_REGISTER_COUNTS: Record<GapRegister, number> = { missing: 2, uncertain: 1, contradictory: 1 };

function FilesSection() {
  const isGuest = useIsGuest();
  const { data, loading, error } = useApi<Page<UploadedFileOut>>(isGuest ? null : "/files");
  const files = data?.items ?? [];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        Files this tenant actually has{" "}
        <InfoTooltip
          term="Uploaded file"
          simple="Every file this tenant has sent through the real upload endpoint (server-computed sha256) -- not a link out, the list itself."
          technical="GET /files, reads the same UploadedFile rows POST /files/upload writes. No second store."
        />
      </h3>
      {isGuest ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          No files in this walk — a guest has no tenant to upload into. Sign in (Home → Set up the demo) to see this
          tenant's own uploads, or try{" "}
          <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to upload real files and come
          back.
        </p>
      ) : loading ? (
        <p className="hint">Loading this tenant's uploaded files…</p>
      ) : error ? (
        <div className="banner error">{error}</div>
      ) : files.length === 0 ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          No files uploaded yet for this tenant — a true empty state, not a placeholder. Try{" "}
          <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to upload real files, or{" "}
          <Link to="/scout/offer-desk/document-check">Document check</Link> to upload one by hand.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>sha256</th>
                <th>What it backs</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>{f.file_name}</td>
                  <td>
                    <code>{f.sha256.slice(0, 12)}…</code>
                  </td>
                  <td>
                    {f.backs.length === 0 ? (
                      <span className="hint">Backs nothing yet.</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {f.backs.map((b, i) => (
                          <li key={i}>
                            <code>{b.work_unit_code}</code> — {b.claim}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RegistersSection() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const { data, loading, error } = useApi<Page<Gap>>(isGuest ? null : withClient("/discovery/gaps", keyClientId));
  const counts = isGuest ? GUEST_REGISTER_COUNTS : countRegisters(data?.items ?? []);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        Three registers{" "}
        <InfoTooltip
          term="Registers"
          simple="Every real conformance gap on this tenant, bucketed into three plain shapes. Counts only -- no coverage percentage is computed anywhere on this page."
        />
      </h3>
      {!isGuest && loading && <p className="hint">Loading this tenant's real conformance gaps…</p>}
      {!isGuest && error && <div className="banner error">{error}</div>}
      <div className="split" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
        {REGISTERS.map((r) => (
          <div key={r} className="card" style={{ margin: 0 }}>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
              {REGISTER_COPY[r].label} <InfoTooltip term={REGISTER_COPY[r].label} simple={REGISTER_COPY[r].simple} />
            </div>
            <p style={{ fontSize: 28, margin: "4px 0" }}>{counts[r]}</p>
          </div>
        ))}
      </div>
      <h4 style={{ marginBottom: 6 }}>Repair list</h4>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {REGISTERS.filter((r) => counts[r] > 0).map((r) => (
          <li key={r} style={{ marginBottom: 4 }}>
            <strong>{REGISTER_COPY[r].label}:</strong> {REGISTER_COPY[r].repair}
          </li>
        ))}
        {REGISTERS.every((r) => counts[r] === 0) && <li>Nothing registered yet — no repair to list.</li>}
      </ul>
      <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
        {isGuest
          ? "Guest: counts replay the same four rows shown on Gap, sorted into these three shapes — not a live query."
          : `Read from this tenant's own conformance gaps (${(data?.items ?? []).length} on file) — same rows the Gap page shows, no invented coverage %.`}
      </p>
    </div>
  );
}

/** CENSUS-v0 Part A, step 3, rebuilt for EVIDENCE-GAP (F1): a real screen,
 * not a link farm. Files this tenant actually has, what each one backs,
 * three named registers with real counts, and a repair list -- everything
 * here reads an existing table (UploadedFile, WorkUnitProvenanceDetail,
 * ConformanceGap) through an existing or newly-read endpoint. No second
 * evidence store, no invented coverage percentage, no Darwinbox/Zwayam API. */
export default function CensusEvidence() {
  const rec = DOCUMENT_CHECK_RECORD;
  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Evidence <InfoTooltip term="Evidence" simple="Proof a stranger could check, not a checker's say-so." />
      </h2>
      <p className="lede">
        {rec.evidenceRequired} — the same document-check contract every genome import on this tenant faces. Below is
        this tenant's own evidence, not a description of it.
      </p>

      <FilesSection />
      <RegistersSection />

      <div className="card" style={{ marginBottom: 16, borderColor: "#b8860b" }}>
        <h3 style={{ marginTop: 0 }}>Explore further</h3>
        <p style={{ fontSize: 13 }}>
          <Link to="/scout/offer-desk/document-check">Document check</Link> — this unit's current/desired condition,
          acceptance criteria, and an optional real upload.{" "}
          <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> — uploads 7 real files and imports
          the genome that cites them.{" "}
          <Link to="/scout/offer-desk/spec-deny">Ask Spec without a pass</Link> — an empty evidence token still
          denies by contract.
        </p>
        <p className="hint" style={{ marginBottom: 0 }}>
          The evidence pack above is fabricated on purpose — not Rashmi's production month, and not a real Zwayam or
          Zoho connector. That page carries its own banner saying so; nothing on this page merges its numbers into
          this tenant's real files above.
        </p>
      </div>

      <IoPanes
        given="Capture: three seats, Offer Desk as the worked example."
        understood="A claim is not evidence. A file with a server-computed hash is, and a register count is not a percentage."
        processed="GET /files (this tenant's own uploads + what each backs) and GET /discovery/gaps (bucketed into three registers). No new store, no new detector."
        output="Real files, real backing, real register counts — zero is an honest answer, not a bug."
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/capture">← Capture</Link>
        <Link to="/census/gap">Next: Gap →</Link>
      </p>
    </>
  );
}
