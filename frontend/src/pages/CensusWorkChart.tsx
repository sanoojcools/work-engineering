import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CensusStepper } from "../components/census/CensusStepper";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { DataTable } from "../ui";
import { NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import { DESKS_BY_ID } from "../lib/desks";
import type { DeskSpec, DeskStep } from "../lib/desks/types";
import { DESK_TO_OBJECT, OBJECTS_BY_ID } from "../lib/desks/objects";
import { scenarioStrip, type ScenarioStrip } from "../lib/offerDeskScenarios";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";
import { OFFER_TO_ONBOARDING_JOURNEY, ensureOfferToOnboardingWorkSystem, ratifyWorkSystem } from "../lib/workSystem";
import type { Page, Verdict, WorkSystem, WorkUnit } from "../types";

const LANE_DESK_IDS = ["offer-desk", "onboarding"] as const;
type LaneDeskId = (typeof LANE_DESK_IDS)[number];

const DESK_CODE_PREFIX: Record<LaneDeskId, string> = { "offer-desk": "OD", onboarding: "ONB" };

/** Real matched-code candidates for one sheet step -- the family-genome
 * 3-digit code (HrFamilyGenome.tsx's own scheme, covers both lanes) tried
 * first, then Offer Desk's own 2-digit evidence-pack code (the only path
 * in this app that actually clears the quality gate for Offer Desk units).
 * Never invented: these are the exact two code shapes this codebase's own
 * import paths already produce. */
function candidateCodes(deskId: LaneDeskId, position: number): string[] {
  const prefix = DESK_CODE_PREFIX[deskId];
  const codes = [`WU-${prefix}-${String(position).padStart(3, "0")}`];
  if (deskId === "offer-desk") codes.push(`WU-OD-${String(position).padStart(2, "0")}`);
  return codes;
}

type ScenarioKey = "careful" | "as-calculated" | "ambitious";
const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "careful", label: "Careful (S1 floor)" },
  { key: "as-calculated", label: "As-calculated (S2)" },
  { key: "ambitious", label: "Ambitious (S3 ceiling)" },
];

function levelBadge(strip: ScenarioStrip, scenario: ScenarioKey): string {
  if (!strip.scored) return "not scored";
  const point = scenario === "careful" ? strip.s1Floor : scenario === "ambitious" ? strip.s3Ceiling : strip.s2Derived;
  return `L${point.level} · ${point.allocation}`;
}

type ChartRow = {
  id: number;
  displayCode: string;
  name: string;
  spoc: string;
  strip: ScenarioStrip;
  clickTo: string;
};

function documentCheckRoute(deskId: LaneDeskId, position: number): string {
  if (deskId === "offer-desk" && position === 2) return "/scout/offer-desk/document-check";
  if (deskId === "offer-desk") return "/scout/offer-desk";
  return "/hr/operations/onboarding";
}

function buildRows(
  deskId: LaneDeskId,
  desk: DeskSpec,
  units: WorkUnit[],
  verdicts: Verdict[],
): ChartRow[] {
  return desk.steps.map((step: DeskStep, i: number) => {
    const position = i + 1;
    const codes = candidateCodes(deskId, position);
    const matched = units.find((u) => codes.includes(u.code)) ?? null;
    const verdict = matched ? verdicts.find((v) => v.work_unit_id === matched.id) ?? null : null;
    return {
      id: i,
      displayCode: matched ? matched.code : `(step ${step.id} — not imported)`,
      name: step.name,
      spoc: step.spoc,
      strip: scenarioStrip(verdict),
      clickTo: documentCheckRoute(deskId, position),
    };
  });
}

function Lane({
  deskId, units, verdicts, scenario, workSystemStatus,
}: {
  deskId: LaneDeskId;
  units: WorkUnit[];
  verdicts: Verdict[];
  scenario: ScenarioKey;
  workSystemStatus: "candidate" | "ratified";
}) {
  const nav = useNavigate();
  const desk = DESKS_BY_ID[deskId];
  const rows = useMemo(() => buildRows(deskId, desk, units, verdicts), [deskId, desk, units, verdicts]);
  const objectId = DESK_TO_OBJECT[deskId];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>{desk.name}</h3>
        <span className={`badge ${workSystemStatus === "ratified" ? "ok" : ""}`}>
          {workSystemStatus === "ratified" ? "ratified" : "candidate · not governed"}
        </span>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        SPOC: {desk.primarySpoc}
        {objectId && (
          <>
            {" · "}
            <Link to={`/hr/objects/${objectId}`}>Object: {OBJECTS_BY_ID[objectId].name} →</Link>
          </>
        )}
      </p>
      <DataTable
        rows={rows}
        onRowClick={(row) => nav(row.clickTo)}
        columns={[
          { key: "code", header: "Code", render: (r) => <code style={{ fontSize: 12 }}>{r.displayCode}</code> },
          { key: "name", header: "Name" },
          { key: "spoc", header: "SPOC", render: (r) => <span className="hint">{r.spoc}</span> },
          { key: "level", header: "Level", render: (r) => levelBadge(r.strip, scenario) },
        ]}
      />
    </div>
  );
}

/** CENSUS-v0 Part C: Work Chart (hero). Purpose strip + the Offer Desk /
 * Onboarding lanes of the one Work System this slice ships. No new math:
 * S1/S2/S3 replays the existing scenarioStrip() exactly as Document check
 * already does. Guest sees the static DeskSpec schematic only (labelled
 * "not imported" where no real code matches); keyed additionally reads
 * real WorkUnit/VerdictScore rows and the real work_systems Ratify state. */
export default function CensusWorkChart() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();

  const unitsApi = useApi<Page<WorkUnit>>(isGuest ? null : withClient("/work-units/", keyClientId));
  const verdictsApi = useApi<Page<Verdict>>(isGuest ? null : withClient("/verdict/", keyClientId));
  const units = unitsApi.data?.items ?? [];
  const verdicts = verdictsApi.data?.items ?? [];

  const [scenario, setScenario] = useState<ScenarioKey>("as-calculated");

  const [workSystem, setWorkSystem] = useState<WorkSystem | null>(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [ratifierName, setRatifierName] = useState("");
  const [ratifying, setRatifying] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setWorkSystem(null);
      return;
    }
    let cancelled = false;
    setWsLoading(true);
    setWsError(null);
    ensureOfferToOnboardingWorkSystem()
      .then((ws) => {
        if (!cancelled) setWorkSystem(ws);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
        else setWsError(err instanceof Error ? err.message : "Could not load the Work System");
      })
      .finally(() => {
        if (!cancelled) setWsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, keyClientId]);

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

  const journey = workSystem ?? { ...OFFER_TO_ONBOARDING_JOURNEY, status: "candidate" as const, ratified_by: "", ratified_at: null };
  const status: "candidate" | "ratified" = journey.status;

  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · hero</p>
      <h2>
        Work Chart{" "}
        <InfoTooltip
          term="Work Chart"
          simple="One journey, drawn as lanes of real (or, for a guest, declared-schematic) units. Toggling careful/as-calculated/ambitious replays the same VERDICT scenario math Document check already uses — no new arithmetic."
        />
      </h2>
      <p className="lede">
        Function: HR operations. This journey's target, from the sheets: {DOCUMENT_CHECK_RECORD.declaredHours} hrs/mo
        declared, {DOCUMENT_CHECK_RECORD.defendedHours} defended (<Link to="/scout/offer-desk/hours">Hours →</Link>).
      </p>

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
            {needsKey && <ApiKeyBanner onSaved={() => { setNeedsKey(false); }} />}
            {wsError && <div className="banner error">{wsError}</div>}
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
          Units of this journey stay labelled candidate / not governed until this Work System is ratified. Viewing
          is never blocked either way — the 95 declared / 61.8 defended units below are not deleted for being a
          candidate.
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
        Same scenario math as Document check's own S1/S2/S3 strip — no second scoring engine. "Not scored" means no
        real VERDICT exists yet for that unit on this tenant.
      </p>

      {!isGuest && (unitsApi.loading || verdictsApi.loading) && (
        <p className="hint">Loading this tenant's real Work Units and VERDICT scores…</p>
      )}

      {LANE_DESK_IDS.map((deskId) => (
        <Lane key={deskId} deskId={deskId} units={units} verdicts={verdicts} scenario={scenario} workSystemStatus={status} />
      ))}

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, margin: 0 }}>
          <strong>HRBP is not a lane here.</strong> No named handoff in the sheets connects HRBP to this
          Offer→Onboarding journey — the three named handoffs (
          <Link to="/hr/function-graph">HR function graph →</Link>) run Offer Desk↔Onboarding and
          Offboarding↔HRBP only. Appetite does not invent a fourth edge to include it.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
        <p style={{ fontSize: 13, margin: 0 }}>
          <strong>Dual employment in UAN is a stop.</strong> Appetite never lifts it, at any scenario above —{" "}
          <Link to="/scout/offer-desk/document-check">see Document check →</Link>.
        </p>
      </div>

      <IoPanes
        given="Gap: the declared-vs-sitting disagreement, already named."
        understood="A chart is a journey, not a desk. Lanes come from the desks this journey actually touches; a unit's level is a scenario replay, not a fresh score."
        processed={
          isGuest
            ? "Guest schematic: desk steps and SPOCs from lib/desks/*.ts, no backend call. Every unit reads not scored."
            : "Real GET /work-units/ + GET /verdict/, matched by this app's own two real code shapes. Work System read/created via GET+POST /work-systems."
        }
        output={`${LANE_DESK_IDS.length} lanes, ${LANE_DESK_IDS.reduce((n, d) => n + DESKS_BY_ID[d].steps.length, 0)} units, journey ${status}.`}
      />

      <p style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
        <Link to="/census/gap">← Gap</Link>
        <Link to="/census/plan">Next: Plan →</Link>
      </p>
    </>
  );
}
