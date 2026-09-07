import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { deskHoursSummary } from "../lib/desks/functionHours";
import type { ScenarioStrip } from "../lib/offerDeskScenarios";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";
import { LANE_DESK_IDS, buildRows, type ChartRow, type LaneDeskId } from "../lib/workSystemUnits";
import { createModerationEntry, listModerationEntries } from "../lib/moderation";
import type { ModerationEntry, Page, Verdict, WorkUnit } from "../types";

// The Document check unit's own real code (OfferDeskDocumentCheck.tsx's
// DOCUMENT_CHECK_CODE, offerDeskEvidencePack.json's WU-OD-02) -- reused here
// as the moderation form's default target when this tenant has not yet
// imported the evidence pack, so the form always has a real code to try
// rather than an empty one. It is only ever a *default*: the tenant either
// has this code as a real Work Unit already or the log entry 404s honestly,
// same as every other "ask the API without a pass" moment on this walk.
const FALLBACK_UNIT_CODE = "WU-OD-02";

function scenarioCell(strip: ScenarioStrip) {
  if (!strip.scored) return <span className="hint">not scored</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      <span className="badge">S1 L{strip.s1Floor.level}</span>
      <span className="badge ok">S2 L{strip.s2Derived.level} (VERDICT)</span>
      <span className="badge">S3 L{strip.s3Ceiling.level}</span>
    </span>
  );
}

function UnitsLane({ deskId, units, verdicts }: { deskId: LaneDeskId; units: WorkUnit[]; verdicts: Verdict[] }) {
  const desk = DESKS_BY_ID[deskId];
  const rows: ChartRow[] = useMemo(() => buildRows(deskId, desk, units, verdicts), [deskId, desk, units, verdicts]);
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h4 style={{ marginTop: 0 }}>{desk.name}</h4>
      <DataTable
        rows={rows}
        columns={[
          { key: "code", header: "Code", render: (r) => <code style={{ fontSize: 12 }}>{r.displayCode}</code> },
          { key: "name", header: "Name" },
          { key: "scenarios", header: "VERDICT · S1 / S2 / S3", render: (r) => scenarioCell(r.strip) },
        ]}
      />
    </div>
  );
}

function ModerationSection({ units, verdicts }: { units: WorkUnit[]; verdicts: Verdict[] }) {
  const isGuest = useIsGuest();
  const matchedRows = useMemo(
    () => LANE_DESK_IDS.flatMap((id) => buildRows(id, DESKS_BY_ID[id], units, verdicts)).filter((r) => r.matched),
    [units, verdicts],
  );
  const options = matchedRows.length > 0 ? matchedRows.map((r) => r.displayCode) : [FALLBACK_UNIT_CODE];

  const [code, setCode] = useState(options[0]);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ModerationEntry[] | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    if (!options.includes(code)) setCode(options[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join("|")]);

  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    setLoadingEntries(true);
    listModerationEntries()
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingEntries(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const selectedRow = matchedRows.find((r) => r.displayCode === code) ?? null;
  const strip = selectedRow?.strip;
  // Real S2/S3 when this exact unit is actually scored; a stated, labelled
  // default (never presented as a real score) when it isn't -- moderation
  // logs an opinion about *a* unit, it does not require every unit on this
  // walk to already be VERDICT-scored to be usable.
  const fromLevel = strip?.scored ? strip.s2Derived.level : 2;
  const toLevel = strip?.scored ? strip.s3Ceiling.level : 3;
  const canSubmit = Boolean(code.trim()) && reason.trim().length > 0 && name.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const entry = await createModerationEntry({
        workUnitCode: code.trim(),
        fromLevel,
        toLevel,
        reason: reason.trim(),
        moderatedBy: name.trim(),
      });
      setEntries((prev) => [entry, ...(prev ?? [])]);
      setReason("");
      setName("");
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Could not log this moderation request — is this a real Work Unit code on this tenant?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>
        Moderation{" "}
        <InfoTooltip
          term="Moderation"
          simple="Moving a unit's allocation from S2 (derived) toward S3 (ceiling) requires a stated reason and a real name, and is logged, append-only. It is an opinion, not a score change: it never writes to VERDICT, never promotes a Work Unit's autonomy level, and never lifts the dual-employment stop."
          technical="POST /moderation, schemas/moderation.py::ModerationEntryIn — reason and moderated_by are required by the schema (422 without either), not only greyed out here."
        />
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Appetite never lifts the dual-employment stop above, and moving toward S3 here cannot enable Release offer —
        that stays disabled on Document check regardless of what any scenario shows.
      </p>

      {isGuest ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Guest: sign in (Home → Set up the demo) to log a moderation request — it needs a real tenant and a real name.
        </p>
      ) : (
        <>
          {needsKey && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
          {error && <div className="banner error">{error}</div>}
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <label>
              Work Unit
              <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Moderation — Work Unit code">
                {options.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Move
              <input readOnly value={`S2 (L${fromLevel}) → S3 (L${toLevel})`} aria-label="Moderation — from level to level" />
            </label>
            <label className="span-2">
              Reason (required)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why this unit's ceiling should be trusted more than its derived level today"
                rows={2}
                aria-label="Moderation — reason"
              />
            </label>
            <label>
              Your name (required)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                aria-label="Moderation — moderated by"
              />
            </label>
          </div>
          <button type="button" className="primary" disabled={!canSubmit || submitting} onClick={() => void submit()}>
            {submitting ? "Logging…" : "Log moderation request"}
          </button>
          {!strip?.scored && (
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              {selectedRow ? selectedRow.displayCode : code} has no real VERDICT score on this tenant yet — S2/S3
              above default to L2/L3 rather than a fabricated real score.{" "}
              <Link to="/verdict">Score it on the Verdict page →</Link>
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 6 }}>Logged</h4>
            {loadingEntries && !entries && <p className="hint">Loading this tenant's moderation log…</p>}
            {entries && entries.length === 0 && <p className="hint" style={{ margin: 0 }}>No moderation requests logged yet on this tenant.</p>}
            {entries && entries.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {entries.map((e) => (
                  <li key={e.id}>
                    <code>{e.work_unit_code}</code> S2(L{e.from_level})→S3(L{e.to_level}) by <strong>{e.moderated_by}</strong> at{" "}
                    {e.created_at} — {e.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** CENSUS-v0 Part A, step 6, rebuilt for INTENT-PLAN (E -- PLAN): a real
 * screen, not a link farm. This journey's own units (VERDICT/S1-S2-S3),
 * the dual-employment stop restated, Spec deny still a link that still
 * denies without a file, Hours (95/61.8 both visible, other desks stated
 * only), a real logged Moderation control, and a quality-gate reminder. No
 * new arithmetic: every number here replays an existing module
 * (scenarioStrip, deskHoursSummary) or reads a real backend row. */
export default function CensusPlan() {
  const isGuest = useIsGuest();
  const { keyClientId } = useCompany();
  const unitsApi = useApi<Page<WorkUnit>>(isGuest ? null : withClient("/work-units/", keyClientId));
  const verdictsApi = useApi<Page<Verdict>>(isGuest ? null : withClient("/verdict/", keyClientId));
  const units = unitsApi.data?.items ?? [];
  const verdicts = verdictsApi.data?.items ?? [];

  const hoursRows = useMemo(() => deskHoursSummary().filter((r) => r.desk.id !== "offer-desk"), []);

  return (
    <>
      <CensusStepper />
      <p className="hint" style={{ marginBottom: 4 }}>Work Census · guest and keyed</p>
      <h2>
        Plan{" "}
        <InfoTooltip
          term="Plan"
          simple="This journey's units with their real (or, for a guest, declared-schematic) VERDICT and S1/S2/S3, the dual-employment stop restated, Hours, a logged Moderation control, and the family-genome quality-gate reminder. No new scoring engine, no new hours math."
        />
      </h2>
      <p className="lede">
        Offer Desk + Onboarding, the one Work System this walk ships. Everything below reads an existing module or a
        real row — nothing here is computed fresh for this screen.
      </p>

      <h3 style={{ marginBottom: 4 }}>This journey's units</h3>
      {!isGuest && (unitsApi.loading || verdictsApi.loading) && (
        <p className="hint">Loading this tenant's real Work Units and VERDICT scores…</p>
      )}
      {LANE_DESK_IDS.map((deskId) => (
        <UnitsLane key={deskId} deskId={deskId} units={units} verdicts={verdicts} />
      ))}

      <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
        <p style={{ fontSize: 13, margin: 0 }}>
          <strong>{DOCUMENT_CHECK_RECORD.stopRule}</strong> Restated from Document check — it does not change here,
          at any scenario above. <Link to="/scout/offer-desk/document-check">See Document check →</Link>
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Spec deny</h3>
        <p style={{ fontSize: 13 }}>
          An evidence-free check on a contracted unit still denies — <code>POST /spec/check</code> with an empty{" "}
          <code>evidence_ref</code> always returns <code>denied, "evidence_ref required by contract"</code>. This
          screen does not re-run that check; it is the same live gate, unchanged.
        </p>
        <Link to="/scout/offer-desk/spec-deny">Ask Spec without a pass →</Link>
      </div>

      <h3 style={{ marginBottom: 4 }}>
        Hours{" "}
        <InfoTooltip
          term="Hours"
          simple="Offer Desk's own declared vs. defended pair, both visible — the smaller, defended number is never hidden behind the bigger declared one. Every other desk states one number only; none gets an invented defended figure."
        />
      </h3>
      <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
        <div className="card" style={{ margin: 0 }}>
          <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Declared</div>
          <p style={{ fontSize: 28, margin: "4px 0" }}>{DOCUMENT_CHECK_RECORD.declaredHours}</p>
          <p style={{ fontSize: 13, margin: 0 }}>hrs/mo, Offer Desk's own workbook line.</p>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Defended</div>
          <p style={{ fontSize: 28, margin: "4px 0" }}>{DOCUMENT_CHECK_RECORD.defendedHours}</p>
          <p style={{ fontSize: 13, margin: 0 }}>hrs/mo, after four costing disciplines. Still declared math, not traces.</p>
        </div>
      </div>
      <Link to="/scout/offer-desk/hours" className="card" style={{ textDecoration: "none", color: "inherit", margin: 0, display: "block", marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>Hours — 95 declared / 61.8 defended</h4>
        <p className="hint" style={{ marginBottom: 0 }}>See the four costing disciplines behind the defended number →</p>
      </Link>
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Other desks — stated only</h4>
        <p className="hint" style={{ marginTop: 0 }}>
          Every other desk's own declared hrs/mo line, verbatim — no second, defended case computed for any of them.
        </p>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Desk</th>
              <th>Stated</th>
            </tr>
          </thead>
          <tbody>
            {hoursRows.map((r) => (
              <tr key={r.desk.id}>
                <td>{r.desk.name}</td>
                <td>{r.raw}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          <Link to="/hr/function-hours">Function hours — all six desks →</Link>
        </p>
      </div>

      <ModerationSection units={units} verdicts={verdicts} />

      <div className="card" style={{ marginBottom: 16, borderColor: "#b8860b" }}>
        <h3 style={{ marginTop: 0 }}>
          Quality gate reminder{" "}
          <InfoTooltip
            term="GQS gate"
            simple="A genome built from six declared sittings, no observed evidence, scores well under the 90-point gate — around 30 — by construction. That is not a defect to plan around; it is what an unverified declared genome honestly is."
          />
        </h3>
        <p style={{ fontSize: 13, margin: 0 }}>
          The family genome (all six desks, declared) is expected to fail GQS — around 30 of the 90-point gate,
          because Observed% is structurally 0 with no system-of-record connector behind it.{" "}
          <strong>~30/90 is not a pass.</strong> Planning against it as if it were governed would misrepresent what
          the gate actually found. <Link to="/hr/family-genome">See the live GQS score →</Link>
        </p>
      </div>

      <IoPanes
        given="Work Chart: the journey's two lanes, real or declared-schematic; this tenant's real Work Units and VERDICT scores."
        understood="A plan restates real numbers, it does not invent a fourth one. Moderation logs an opinion about a scenario replay — it is not the VERDICT promotion ladder, and it cannot lift a hard gate."
        processed="Same scenarioStrip() replay as Work Chart and Document check. Same deskHoursSummary() as the function-hours panel. Moderation is real: GET/POST /moderation, reason + name required server-side."
        output={`${LANE_DESK_IDS.reduce((n, d) => n + DESKS_BY_ID[d].steps.length, 0)} units listed. ${DOCUMENT_CHECK_RECORD.declaredHours}/${DOCUMENT_CHECK_RECORD.defendedHours} hrs. Family genome ~30/90 — not a pass.`}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/census/chart">← Work Chart</Link>
      </p>
    </>
  );
}
