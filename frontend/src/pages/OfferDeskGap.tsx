import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { GAP_ROWS } from "../lib/offerDeskWorkRecord";
import { useApi } from "../hooks";
import { useCompany } from "../company";
import { useIsGuest } from "../lib/guestMode";
import { withClient } from "../lib/withClient";
import type { Gap, Page } from "../types";

/** The only three GapKind values a genome import can produce (Gates 10, 6, 9
 * — docs/BUILD_PROGRAM.md Track 1 slices 1.1-1.3). Other kinds exist in the
 * schema (shadow_process, unimplemented, missing_acceptance, ...) but come
 * from a different mechanism entirely (/discovery/gaps/scan, the census SOP
 * comparison) and are not what this screen is about — showing them here
 * would misrepresent an unrelated finding as part of "the gap is the
 * finding" for this Offer Desk sitting. */
const GATE_KINDS = ["undeclared", "split_recommended", "missing_terminal_state"] as const;
type GateKind = (typeof GATE_KINDS)[number];

function isGateKind(kind: string): kind is GateKind {
  return (GATE_KINDS as readonly string[]).includes(kind);
}

const KIND_COPY: Record<GateKind, { label: string; simple: string; technical: string }> = {
  undeclared: {
    label: "Said, but not backed up yet",
    simple:
      "Someone described this step in an interview (declared), and no uploaded file or system record (observed) backs the same business object yet. It is a warning, not a rejection — the import still went through.",
    technical: "Gate 10 — GapKind.undeclared. Flagged at genome import, severity P2, advisory only.",
  },
  split_recommended: {
    label: "Reads like more than one job bundled together",
    simple:
      "The object or approver named for this step actually names more than one thing. We flag it for a person to look at — we never split it automatically.",
    technical: "Gate 6 — GapKind.split_recommended. Flagged at genome import, severity P2, advisory only.",
  },
  missing_terminal_state: {
    label: "No clear finish line yet",
    simple:
      "We looked at every before/after state this business object moves through across all its Work Units and never found one that nothing else builds on next — so the process doesn't obviously end anywhere. Needs 3+ Work Units on the same object before we even check.",
    technical: "Gate 9 — GapKind.missing_terminal_state. Flagged at genome import, severity P2, advisory only. No state machine is written.",
  },
};

export default function OfferDeskGap() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const { data, loading, error } = useApi<Page<Gap>>(
    isGuest ? null : withClient("/discovery/gaps", keyClientId),
  );
  const realGaps = (data?.items ?? []).filter((g) => isGateKind(g.kind));

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · declared vs sitting
      </p>
      <h2>
        The gap is the finding{" "}
        <InfoTooltip
          term="Conformance gap"
          simple="What upstairs named versus what the sitting described. We do not vote the three columns into one story."
        />
      </h2>
      <p className="lede">
        Playback kept three columns. This page names the disagreement. That disagreement is the commercial output of discovery, not a defect to hide.
      </p>
      <SeatStepper />

      {isGuest ? (
        <>
          <p className="hint">
            No genome exists for a guest — this table is the educational walkthrough of what a gap looks like, not a live query. Nothing here is saved.
          </p>
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
        </>
      ) : loading ? (
        <p className="hint">Loading real conformance gaps for this tenant…</p>
      ) : error ? (
        <div className="banner error">{error}</div>
      ) : realGaps.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Nothing flagged for this tenant — a true empty state, not a clean bill of health.</strong>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
            No genome import on this tenant has tripped an "undeclared", "reads like more than one job," or "no clear
            finish line" check yet. That can mean no genome has been imported at all, or it can mean one was imported
            and none of these three checks fired. Try{" "}
            <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to import a real genome and come
            back — this page never invents a row to fill the space while you wait.
          </p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table>
            <thead>
              <tr>
                <th>What we found</th>
                <th>Why</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {realGaps.map((g) => {
                const copy = KIND_COPY[g.kind as GateKind];
                return (
                  <tr key={g.id}>
                    <td>
                      {copy.label} <span className="hint">[{g.kind}]</span>{" "}
                      <InfoTooltip term={g.kind} simple={copy.simple} technical={copy.technical} />
                    </td>
                    <td>{g.description}</td>
                    <td>{g.declared_ref || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <IoPanes
        given={
          isGuest
            ? "CHRO stand-in, HR Ops stand-in, Rashmi sitting, the sheet."
            : "Every Work Unit this tenant has imported, and the three advisory gates (10, 6, 9) that ran at each import."
        }
        understood="Declared upstairs is not the same record as declared at the desk."
        processed={
          isGuest
            ? "We write the disagreement down. We do not invent Zwayam events to close it."
            : "GET /discovery/gaps, filtered to the three gate kinds a genome import can produce. Nothing manually curated for this page."
        }
        output={
          isGuest
            ? "Four named gaps. Hours and systems stay labelled declared."
            : realGaps.length > 0
              ? `${realGaps.length} real gap(s), read from this tenant's own imports.`
              : "No gaps flagged yet for this tenant — not the same claim as zero risk."
        }
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/document-check">Open document check →</Link>
      </p>
    </>
  );
}
