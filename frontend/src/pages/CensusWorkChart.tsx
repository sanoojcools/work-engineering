import { useState } from "react";
import { Link } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { HireLeavesChart } from "../components/census/HireLeavesChart";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { NeedsApiKeyError } from "../lib/apiFetch";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";
import { HIRE_LEAVES } from "../lib/hireLeaves";
import { confirmFunctionIntent, confirmWorkSystemIntent, ratifyWorkSystem, useWorkSystem } from "../lib/workSystem";
import type { IntentOut, Page, Verdict, WorkUnit } from "../types";

type ScenarioKey = "careful" | "as-calculated" | "ambitious";
const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "careful", label: "Careful" },
  { key: "as-calculated", label: "As calculated" },
  { key: "ambitious", label: "Ambitious" },
];

/** D -- INTENT-LITE. One intent's card: label (outcome or purpose) + owner +
 * (Function intent only) measure, a draft/confirmed badge that never looks
 * governed while unconfirmed, and — keyed only — a name field + "Confirm as
 * owner" button. Guest sees the identical drafted text, labelled draft. */
function IntentCard({
  title, infoTerm, infoSimple, intent, isGuest, onConfirm, confirming,
}: {
  title: string;
  infoTerm: string;
  infoSimple: string;
  intent: IntentOut;
  isGuest: boolean;
  onConfirm: (name: string) => void;
  confirming: boolean;
}) {
  const [name, setName] = useState("");
  const confirmed = intent.status === "confirmed";
  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h4 style={{ margin: 0 }}>
          {title} <InfoTooltip term={infoTerm} simple={infoSimple} />
        </h4>
        <span className={`badge ${confirmed ? "ok" : ""}`}>
          {confirmed ? `confirmed — ${intent.confirmed_by}` : "draft · unconfirmed"}
        </span>
      </div>
      <p style={{ fontSize: 13, margin: "8px 0" }}>{intent.label || "Not drafted yet."}</p>
      <p className="hint" style={{ margin: 0 }}>
        Owner: {intent.owner || "not stated"}
        {intent.measure !== null && <> · Measure: {intent.measure || "not stated"}</>}
      </p>
      {isGuest ? (
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Guest: shown as draft/sitting — sign in to Confirm as owner.
        </p>
      ) : confirmed ? (
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Confirmed by {intent.confirmed_by} at {intent.confirmed_at}. Persisted — survives a refresh.
        </p>
      ) : (
        <div className="toolbar" style={{ marginTop: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Confirmed by"
            aria-label={`${title} — confirmed by`}
          />
          <button type="button" disabled={confirming || !name.trim()} onClick={() => onConfirm(name.trim())}>
            {confirming ? "Confirming…" : "Confirm as owner"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Work Chart (hero). Purpose strip + V10-4's 18-leaf seed in four bands
 * including external, under the composite “the hire is complete”. No new
 * math: careful / as calculated / ambitious still replay scenarioStrip()
 * when a real WU-HIRE-* VERDICT exists; otherwise every leaf reads not
 * scored. Guest sees the declared seed with stand-in names — never Rashmi
 * or Zwayam. Plan (CensusPlan.tsx) is untouched this slice. */
export default function CensusWorkChart() {
  const { isGuest, workSystem, journey, loading: wsLoading, error: wsError, needsKey, setNeedsKey, setWorkSystem, setError: setWsError } =
    useWorkSystem();
  const { keyClientId } = useCompany();

  const unitsApi = useApi<Page<WorkUnit>>(isGuest ? null : withClient("/work-units/", keyClientId));
  const verdictsApi = useApi<Page<Verdict>>(isGuest ? null : withClient("/verdict/", keyClientId));
  const units = unitsApi.data?.items ?? [];
  const verdicts = verdictsApi.data?.items ?? [];

  const [scenario, setScenario] = useState<ScenarioKey>("as-calculated");
  const [ratifierName, setRatifierName] = useState("");
  const [ratifying, setRatifying] = useState(false);
  const [confirmingFn, setConfirmingFn] = useState(false);
  const [confirmingWs, setConfirmingWs] = useState(false);

  const status: "candidate" | "ratified" = journey.status;

  async function ratify() {
    if (!workSystem || !ratifierName.trim()) return;
    setRatifying(true);
    try {
      const updated = await ratifyWorkSystem(workSystem.id, ratifierName.trim());
      setWorkSystem(updated);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setWsError(err instanceof Error ? err.message : "Ratify failed");
    } finally {
      setRatifying(false);
    }
  }

  async function onConfirmFunctionIntent(name: string) {
    if (!workSystem) return;
    setConfirmingFn(true);
    try {
      setWorkSystem(await confirmFunctionIntent(workSystem.id, name));
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setWsError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setConfirmingFn(false);
    }
  }

  async function onConfirmWorkSystemIntent(name: string) {
    if (!workSystem) return;
    setConfirmingWs(true);
    try {
      setWorkSystem(await confirmWorkSystemIntent(workSystem.id, name));
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setWsError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setConfirmingWs(false);
    }
  }

  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · hero</p>
      <h2>
        Work Chart{" "}
        <InfoTooltip
          term="Work Chart"
          simple="One journey, drawn as 18 pieces of work in four bands — including work outside this desk. Toggling careful / as calculated / ambitious replays the same score Document check already uses — no new arithmetic."
        />
      </h2>
      <p className="lede">
        Function: HR operations. This journey's target, from the sheets: {DOCUMENT_CHECK_RECORD.declaredHours} hrs/mo
        declared, {DOCUMENT_CHECK_RECORD.defendedHours} defended (<Link to="/scout/offer-desk/hours">Hours →</Link>).
      </p>

      <h3 style={{ marginBottom: 4 }}>
        Purpose{" "}
        <InfoTooltip
          term="Intent"
          simple="Two sentences, drafted from sheet/sitting text, not an invented COO strategy: what HR operations is for, and what this specific journey is for. Draft until a keyed 'Confirm as owner' names who stands behind it and when."
        />
      </h3>
      {needsKey && !isGuest && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {wsError && <div className="banner error">{wsError}</div>}
      <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <IntentCard
          title="Function intent — HR operations"
          infoTerm="Function intent"
          infoSimple="One sentence: what HR operations is for, who owns that outcome (stand-in ok), and the sheet's own SLA measure if it names one — otherwise 'not stated', never invented."
          intent={journey.function_intent}
          isGuest={isGuest}
          onConfirm={(name) => void onConfirmFunctionIntent(name)}
          confirming={confirmingFn}
        />
        <IntentCard
          title="Work System intent — this journey"
          infoTerm="Work System intent"
          infoSimple="What this offer→Day-1 journey is for, in the sitting's own words, plus who owns it. Entry and exit are already on the card below; this is the why."
          intent={journey.work_system_intent}
          isGuest={isGuest}
          onConfirm={(name) => void onConfirmWorkSystemIntent(name)}
          confirming={confirmingWs}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>
            {journey.name}{" "}
            <InfoTooltip
              term="Work System"
              simple="The missing middle: one named journey spanning more than one desk. Candidate until a keyed Ratify names who governed it and when — viewing stays allowed either way."
            />
          </h3>
          <span className={`badge ${status === "ratified" ? "ok" : ""}`}>
            {status === "ratified" ? `ratified — ${journey.ratified_by}` : "candidate · not governed"}
          </span>
        </div>
        <dl className="story-fields graph-detail-grid" style={{ marginTop: 10 }}>
          <dt>Entry</dt>
          <dd>{journey.entry}</dd>
          <dt>Exit</dt>
          <dd>{journey.exit}</dd>
          <dt>Owner</dt>
          <dd>{journey.owner}</dd>
          <dt>Outcome</dt>
          <dd>{journey.outcome}</dd>
        </dl>

        {isGuest ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            Guest: shown as candidate — sign in to see this tenant's real Ratify state, and to Ratify it yourself.
          </p>
        ) : (
          <>
            {wsLoading && !workSystem && <p className="hint">Loading this tenant's Work System…</p>}
            {status === "candidate" && workSystem && (
              <div className="toolbar" style={{ marginTop: 10 }}>
                <input
                  value={ratifierName}
                  onChange={(e) => setRatifierName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Ratified by"
                />
                <button type="button" className="primary" disabled={ratifying || !ratifierName.trim()} onClick={() => void ratify()}>
                  {ratifying ? "Ratifying…" : "Ratify Work System"}
                </button>
              </div>
            )}
            {status === "ratified" && (
              <p className="hint" style={{ marginBottom: 0 }}>
                Ratified by {journey.ratified_by} at {journey.ratified_at}. Persisted — survives a refresh.
              </p>
            )}
          </>
        )}
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Pieces of this journey stay labelled candidate / not governed until this Work System is ratified. Viewing
          is never blocked either way — the 18 leaves below are not deleted for being a candidate. {DOCUMENT_CHECK_RECORD.declaredHours}{" "}
          declared / {DOCUMENT_CHECK_RECORD.defendedHours} defended stay the Offer Desk totals, not numbers on a leaf.
        </p>
      </div>

      <div className="tabs" style={{ marginBottom: 4 }}>
        {SCENARIOS.map((s) => (
          <button key={s.key} type="button" aria-selected={scenario === s.key} onClick={() => setScenario(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Careful / as calculated / ambitious{" "}
        <InfoTooltip
          term="S1 / S2 / S3"
          simple="Three ways to read the same score: careful is the floor, as calculated is what VERDICT derived, ambitious is the ceiling. Appetite does not lift a stop."
          technical="Same scenarioStrip() as Document check — S1 floor / S2 derived / S3 ceiling. No second scoring engine."
        />{" "}
        — "Not scored" means no real score exists yet for that piece on this tenant.
      </p>

      {!isGuest && (unitsApi.loading || verdictsApi.loading) && (
        <p className="hint">Loading this tenant's real Work Units and VERDICT scores…</p>
      )}

      <HireLeavesChart units={units} verdicts={verdicts} scenario={scenario} />

      <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
        <p style={{ fontSize: 13, margin: 0 }}>
          <strong>Dual employment in UAN is a stop.</strong> Appetite never lifts it, at any scenario above —{" "}
          <Link to="/scout/offer-desk/document-check">see Document check →</Link>.
        </p>
      </div>

      <IoPanes
        given="Gap: the declared-vs-sitting disagreement, already named."
        understood="A chart is the hire, drawn as 18 pieces in four bands including work outside this desk. Careful / as calculated / ambitious replay the same score Document check already uses — not a fresh number. Purpose is two sentences, not a strategy document."
        processed={
          isGuest
            ? "Guest schematic: 18 leaves from the declared hire-leaves seed, stand-in names, no backend call. Every piece reads not scored. Purpose shown as drafted, unconfirmed."
            : "18 leaves from the same declared seed. Real GET /work-units/ + GET /verdict/ matched only when a WU-HIRE-* row exists; otherwise not scored. Work System (incl. both intents) via GET+POST /work-systems; Confirm as owner via POST /work-systems/{id}/confirm-*-intent."
        }
        output={`${HIRE_LEAVES.length} leaves, 4 bands including external, composite “the hire is complete”, journey ${status}, intents ${journey.function_intent.status}/${journey.work_system_intent.status}.`}
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/gap">← Gap</Link>
        <Link to="/census/plan">Next: Plan →</Link>
      </p>
    </>
  );
}
