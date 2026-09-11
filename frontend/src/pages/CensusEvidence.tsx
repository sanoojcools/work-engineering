import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { EvidenceClaims } from "../components/census/EvidenceClaims";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";
import { GUEST_REGISTER_COUNTS, REGISTERS, REGISTER_COPY, countRegisters } from "../lib/gapRegisters";
import { useApi } from "../hooks";
import { useIsGuest } from "../lib/guestMode";
import { withClient } from "../lib/withClient";
import { useCompany } from "../company";
import type { EvidenceCatalogueOut, Gap, Page } from "../types";

function FilesSection() {
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();
  const { data, loading, error } = useApi<EvidenceCatalogueOut>(
    isGuest || firstLoadPending ? null : "/evidence/catalogue",
  );
  const items = data?.items ?? [];
  const waiting = firstLoadPending || (!isGuest && loading);

  return (
    <div className="card" data-testid="evidence-catalogue" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        Files this tenant actually has{" "}
        <InfoTooltip
          term="Connected or not"
          simple="A file is connected when at least one claim on this tenant really opens in it. Otherwise it is not. This is not a percentage, and looking does not invent a pack."
          technical="GET /api/evidence/catalogue. coverage=connected when a field_pointers row for this file has resolved=true; else not. Empty tenant returns items=[]. Guest never calls this."
        />
      </h3>
      {isGuest && !firstLoadPending ? (
        <p className="hint" data-testid="evidence-catalogue-empty" style={{ marginBottom: 0 }}>
          No files in this walk — a guest has no tenant to upload into. Sign in (Home → Set up the demo) to see this
          tenant's own uploads, or try{" "}
          <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to upload real files and come
          back.
        </p>
      ) : waiting ? (
        <p className="hint">Loading this tenant's files…</p>
      ) : error ? (
        <div className="banner error">{error}</div>
      ) : items.length === 0 ? (
        <p className="hint" data-testid="evidence-catalogue-empty" style={{ marginBottom: 0 }}>
          No files uploaded yet for this tenant — a true empty state, not a placeholder. Try{" "}
          <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to upload real files, or{" "}
          <Link to="/scout/offer-desk/document-check">Document check</Link> to upload one by hand.
        </p>
      ) : (
        <>
          <p className="hint" data-testid="evidence-catalogue-totals" style={{ marginTop: 0 }}>
            {data?.connected ?? 0} connected · {data?.not ?? 0} not
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Connected or not</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} data-testid={`evidence-catalogue-row-${f.id}`}>
                    <td>{f.file_name}</td>
                    <td data-testid={`evidence-catalogue-coverage-${f.id}`}>
                      {f.coverage === "connected" ? "connected" : "not"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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

/** CENSUS-v0 Part A, step 3. V10-10: this tenant's files as connected or
 * not (GET /evidence/catalogue). Click a claim: file + cell/page, or cannot
 * open. Guest: "No files in this walk." Never invent a pack. No coverage %. */
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

      <EvidenceClaims />
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
        understood="A claim is not a fact until its pointer opens. Guest looking does not mint a key."
        processed="GET /work-units/{id}/pointers (click a claim), GET /evidence/catalogue (connected or not), GET /discovery/gaps. Guest never calls these. No new table, no resolver in this UI."
        output="Click a claim: file + cell/page, or cannot open. Each file is connected or not. Composed is a badge. Binding fields are said by a person."
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/capture">← Capture</Link>
        <Link to="/census/gap">Next: Gap →</Link>
      </p>
    </>
  );
}
