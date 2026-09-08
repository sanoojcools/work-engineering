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
import { GAP_TIERS, TIER_COPY, gapsInTier, type GapTier } from "../lib/gapTiers";
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

function LiveGapTable({ gaps }: { gaps: Gap[] }) {
  return (
    <div className="table-wrap" style={{ marginBottom: 0 }}>
      <table>
        <thead>
          <tr>
            <th>What we found</th>
            <th>Why</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((g) => {
            const copy = KIND_COPY[g.kind as GateKind];
            return (
              <tr key={g.id}>
                <td>
                  {copy.label}{" "}
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
  );
}

function GuestWalkTable() {
  return (
    <div className="table-wrap" style={{ marginBottom: 8 }}>
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
  );
}

function TierBucket({
  tier,
  gaps,
  isGuest,
  loading,
  error,
}: {
  tier: GapTier;
  gaps: Gap[];
  isGuest: boolean;
  loading: boolean;
  error: boolean;
}) {
  const copy = TIER_COPY[tier];
  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid={`gap-tier-${tier}`}>
      <h3 style={{ marginTop: 0 }} data-testid={`gap-tier-heading-${tier}`}>
        {copy.heading}{" "}
        <InfoTooltip term={copy.term} simple={copy.simple} technical={copy.technical} />
      </h3>
      {isGuest && tier === "process" ? (
        <>
          <GuestWalkTable />
          <p className="hint" style={{ marginBottom: 0 }}>
            {copy.emptyGuest}
          </p>
        </>
      ) : isGuest ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          {copy.emptyGuest}
        </p>
      ) : error ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Could not load this tenant’s rows — not a clean bill of health.
        </p>
      ) : loading ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Loading this tenant’s real rows for this bucket…
        </p>
      ) : gaps.length === 0 ? (
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          {copy.emptyKeyed}
          {tier === "process" && (
            <>
              {" "}
              Try <Link to="/scout/offer-desk/evidence-pack">With evidence (sample)</Link> to import a real
              genome and come back — this page never invents a row to fill the space while you wait.
            </>
          )}
        </p>
      ) : (
        <LiveGapTable gaps={gaps} />
      )}
    </div>
  );
}

/** CENSUS-v0 Part A, step 4, rebuilt for V10-5b: three buckets from the
 * live `conformance_gaps.tier` column (this desk / handoff to the next
 * desk / promised vs not measured). Offer Desk Gap (OfferDeskGap.tsx)
 * stays reachable and unmodified. No new detector, no fake
 * measured-vs-declared KPI. Guest never calls the API and never mints
 * `we-spec-key`. */
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
        Playback keeps three columns. This step names the disagreement between them in three places — this desk,
        the handoff to the next desk, and the promise versus what has been measured. It does not vote them into
        one story, and it does not compute a new score to paper over it.
      </p>

      {!isGuest && error && <div className="banner error">{error}</div>}

      {GAP_TIERS.map((tier) => (
        <TierBucket
          key={tier}
          tier={tier}
          gaps={gapsInTier(realGaps, tier)}
          isGuest={isGuest}
          loading={!isGuest && loading}
          error={!isGuest && Boolean(error)}
        />
      ))}

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
        processed="GET /discovery/gaps, grouped by the live three-bucket column, and GET /scout/contradictions (no session filter). Guest never calls these."
        output={
          isGuest
            ? "Three buckets (this desk walk-only; handoff and promised-vs-not-measured honestly empty). No key minted."
            : `${realGaps.length} real genome-import gap(s) for this tenant in three buckets, plus whatever the Contradiction Resolver above found.`
        }
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/evidence">← Evidence</Link>
        <Link to="/census/chart">Next: Work Chart →</Link>
      </p>
    </>
  );
}
