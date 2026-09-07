import { useState } from "react";
import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { ContradictionResolver } from "../components/scout/ContradictionResolver";
import { GAP_ROWS } from "../lib/offerDeskWorkRecord";
import { OFFER_DESK_META } from "../lib/offerDeskData";
import { ONBOARDING_SPEC } from "../lib/desks/onboarding";
import { useApi } from "../hooks";
import { useCompany } from "../company";
import { useIsGuest } from "../lib/guestMode";
import { withClient } from "../lib/withClient";
import type { Gap, Page } from "../types";

/** The only three GapKind values a genome import can produce (Gates 10, 6, 9
 * -- docs/BUILD_PROGRAM.md Track 1 slices 1.1-1.3), duplicated from
 * OfferDeskGap.tsx rather than imported from it: OfferDeskGap "stays
 * reachable" unmodified (F2), so this journey-wide screen reads the exact
 * same live data through its own small copy instead of refactoring a
 * shipped, tested page to share it. */
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

// Leading system name only (drop each entry's parenthetical detail) --
// pulled from each desk's own real systems list, not retyped.
const firstWord = (s: string) => s.split(" (")[0];
const OFFER_SYSTEMS = OFFER_DESK_META.systems.map(firstWord).join(", ");
const ONBOARDING_SYSTEMS = ONBOARDING_SPEC.systems.map(firstWord).join(", ");

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
            <strong>No connector, on either desk.</strong> Offer Desk's own transition notes name {OFFER_SYSTEMS};
            Onboarding's own systems list names {ONBOARDING_SYSTEMS}. This platform reads none of them — every
            "declared" or "observed" label anywhere on this journey comes from an interview or an uploaded file,
            never a live event from any of those systems.
          </li>
          <li>
            <strong>Judgment-blind.</strong> Offer Desk's own sitting names what a check cannot see: "judgment on
            employment gaps, dual employment decisions, non-standard documents" — those calls happen in Rashmi's
            head, on each candidate, and leave no record this platform can compare against (Exception 9: she is the
            only person who makes them, with no formal backup). A gap check can tell you a business object has no
            corroborating file; it cannot tell you whether a judgment call inside a step was made well — on this desk
            or the next one.
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
