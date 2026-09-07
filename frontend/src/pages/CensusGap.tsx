import { useState } from "react";
import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { ContradictionResolver } from "../components/scout/ContradictionResolver";
import { GAP_ROWS } from "../lib/offerDeskWorkRecord";
import {
  CANNOT_SEE_CONNECTOR_BODY,
  CANNOT_SEE_CONNECTOR_LEAD,
  CANNOT_SEE_JUDGMENT_BODY,
  CANNOT_SEE_JUDGMENT_LEAD,
  isGateKind,
  KIND_COPY,
  type GateKind,
} from "../lib/gapGateKinds";
import { useApi } from "../hooks";
import { useCompany } from "../company";
import { useIsGuest } from "../lib/guestMode";
import { withClient } from "../lib/withClient";
import type { Gap, Page } from "../types";

function HeadVsDoer() {
  const isGuest = useIsGuest();
  const [needsKey, setNeedsKey] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        Head vs doer{" "}
        <InfoTooltip
          term="Contradiction Resolver"
          simple="Deterministic text diff between a Function Head session and an SME session that named the same work unit -- not an AI judgment call. This screen reuses it unchanged; it does not add a second comparison."
          technical="GET /scout/contradictions, services/scout_contradictions.py::detect_and_upsert. Same engine ScoutInterview.tsx's own elevation tab uses, called here with no session_id filter -- every session on this tenant, not one."
        />
      </h3>
      {isGuest ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Guest: this compares a real Function Head interview session against a real SME session for the same
          tenant — there is nothing to compare without one of each. Sign in and run two Scout interview sessions
          naming the same work unit to see a real disagreement surface here.
        </p>
      ) : (
        <>
          {needsKey && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
          <ContradictionResolver onNeedsKey={() => setNeedsKey(true)} />
        </>
      )}
    </div>
  );
}

/** CENSUS-v0 Part A, step 4, rebuilt for EVIDENCE-GAP (F2): journey-wide,
 * not a thin link-out. Offer Desk Gap (OfferDeskGap.tsx) stays reachable
 * and unmodified; this screen adds what's genuinely wider than one desk's
 * sitting -- every gate-kind row on the tenant, the Contradiction Resolver
 * across every Scout session (not one), and "what this sitting cannot see"
 * restated for both desks in this journey. No new detector, no fake
 * measured-vs-declared KPI. */
export default function CensusGap() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const { data, loading, error } = useApi<Page<Gap>>(
    isGuest ? null : withClient("/discovery/gaps", keyClientId),
  );
  const realGaps = (data?.items ?? []).filter((g) => isGateKind(g.kind));

  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Gap <InfoTooltip term="Gap" simple="What upstairs named versus what the sitting described. The disagreement is the finding, not a defect to hide." />
      </h2>
      <p className="lede">
        Playback keeps three columns. This step names the disagreement between them, journey-wide — it does not vote
        them into one story, and it does not compute a new score to paper over it.
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
          <p className="hint" style={{ padding: "0 12px 12px", margin: 0 }}>
            Guest: the same four illustrative rows shown throughout this walk — not a live query, no Client A data.
          </p>
        </div>
      ) : loading ? (
        <p className="hint">Loading this tenant's real conformance gaps…</p>
      ) : error ? (
        <div className="banner error">{error}</div>
      ) : realGaps.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Nothing flagged for this tenant — a true empty state, not a clean bill of health.</strong>
          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
            No genome import on this tenant has tripped an "undeclared," "reads like more than one job," or "no clear
            finish line" check yet. Try <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to
            import a real genome and come back — this page never invents a row to fill the space while you wait.
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

      <HeadVsDoer />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          What this journey cannot see{" "}
          <InfoTooltip
            term="Sitting-blind"
            simple="A conformance gap only catches what someone thought to declare, or what a genome import happens to check for. It is not a coverage guarantee, on either desk."
          />
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li style={{ marginBottom: 8 }}>
            <strong>{CANNOT_SEE_CONNECTOR_LEAD}</strong> {CANNOT_SEE_CONNECTOR_BODY}
          </li>
          <li>
            <strong>{CANNOT_SEE_JUDGMENT_LEAD}</strong> {CANNOT_SEE_JUDGMENT_BODY}
          </li>
        </ul>
        <p className="hint" style={{ marginBottom: 0 }}>
          Neither of these is a percentage. There is no "coverage" number on this page — a gap check is a spotlight,
          not a meter.
        </p>
      </div>

      <p className="hint" style={{ marginBottom: 16 }}>
        This screen does not fake a measured-vs-declared score for the journey. Where a real sheet number already
        exists it is quoted where it lives and labelled declared — Offer Desk's 95 hrs/mo on{" "}
        <Link to="/scout/offer-desk/hours">Hours</Link>, the family genome's own real GQS on{" "}
        <Link to="/hr/family-genome">its own screen</Link> — never blended into a new percentage here.
      </p>

      <p style={{ marginBottom: 16 }}>
        <Link to="/scout/offer-desk/gap">Open Offer Desk's own Gap page →</Link>
      </p>

      <IoPanes
        given="Evidence: what's been uploaded or checked so far, journey-wide."
        understood="Declared upstairs is not the same record as declared at the desk — on either desk, and not the same as what one interview session says versus another."
        processed="GET /discovery/gaps (Gates 6/9/10, unfiltered by desk) and GET /scout/contradictions (no session filter) -- the same two engines OfferDeskGap and ScoutInterview already use, read journey-wide instead of one sitting at a time."
        output={
          isGuest
            ? "Four named gaps (guest, illustrative)."
            : `${realGaps.length} real gate-kind gap(s) for this tenant, plus whatever the Contradiction Resolver above found.`
        }
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/evidence">← Evidence</Link>
        <Link to="/census/chart">Next: Work Chart →</Link>
      </p>
    </>
  );
}
