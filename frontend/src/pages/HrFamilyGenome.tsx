import { useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { ApiError } from "../api";
import { buildFamilyGenomePayload } from "../lib/desks/familyGenome";

type GenomeImportResult = {
  accepted: boolean;
  version_id: number | null;
  sequence: number | null;
  gqs: number;
  gate_threshold: number;
  breakdown: Record<string, number | boolean | null>;
  violations: Array<{ code: string; detail: string }>;
  work_unit_count: number;
  conformance_gaps_flagged?: number;
};

const { payload, crossDeskEdges, unitsByDesk } = buildFamilyGenomePayload();

export default function HrFamilyGenome() {
  const isGuest = useIsGuest();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenomeImportResult | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = await apiFetch.post<GenomeImportResult>("/genome/import", payload);
      setResult(body);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) {
        setNeedsKey(true);
      } else if (err instanceof ApiError) {
        try {
          const parsed = JSON.parse(err.body) as { detail?: GenomeImportResult };
          if (parsed.detail) {
            setResult(parsed.detail);
            return;
          }
        } catch {
          /* fall through */
        }
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        HR function · one genome, six desks
      </p>
      <h2>
        Import family (declared){" "}
        <InfoTooltip
          term="Family genome"
          simple="Every desk's own steps, one payload, the same POST /genome/import and GQS>=90 gate every genome faces. Every unit is declared -- an interview/sitting claim, not a system log."
        />
      </h2>
      <p className="lede">
        Same client as Offer Desk, same import pipeline, same gate. Built straight from the six DeskSpec sittings
        already shown across HR operations and HRBP -- nothing re-typed for this screen. Every one of the {payload.work_units.length}{" "}
        Work Units below is <code>declared</code>: this platform has no Darwinbox, Zwayam, or Job Vite connector, so
        there is no observed system-of-record log to cite for any of them, including Onboarding and Offboarding even
        though their sittings are finalized. That keeps Observed% at 0 and this genome under the 90-point gate by
        construction -- not a bug to fix, the honest outcome of six declared sittings with no evidence pack behind
        them.
      </p>

      <div className="card" style={{ marginBottom: 16, borderColor: "#b8860b" }}>
        <strong>This is expected to fail GQS. That is the point of this screen, not a defect.</strong>
        <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
          Offer Desk's own evidence pack (<Link to="/scout/offer-desk/evidence-pack">see it</Link>) is the only path
          in this app that can clear GQS for <code>WU-OD-*</code> units, and it does so on a separate, clearly-labeled
          genome citing 7 real uploaded files. Its 92.73 score is not merged into this family genome, and none of its{" "}
          <code>WU-OD-01..11</code> codes are reused here (this screen's Offer Desk units are <code>WU-OD-001..011</code>,
          3-digit — a different, declared-only set) — importing both into the same tenant does not collide and does
          not average the two into a false "all desks observed" picture.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Units per desk</h3>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Desk</th>
              <th>Status</th>
              <th>Units</th>
              <th>Code range</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(unitsByDesk).map(([deskId, units]) => (
              <tr key={deskId}>
                <td>{units[0]?.business_object ?? deskId}</td>
                <td>
                  <span className="hint">
                    {["onboarding", "offboarding"].includes(deskId) ? "finalized sitting" : deskId === "offer-desk" ? "live" : "needs follow-up"}
                  </span>
                </td>
                <td>{units.length}</td>
                <td>
                  <code>
                    {units[0]?.id} .. {units[units.length - 1]?.id}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          {payload.work_units.length} Work Units total, all <code>provenance.source_type = declared</code>.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Cross-desk handoff edges{" "}
          <InfoTooltip
            term="Handoff dependency"
            simple="The same three handoffs already drawn on the HR function graph, wired here as real dependencies -- not a fourth edge type, not a fabricated one."
          />
        </h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Sequence edges run within each desk (a step depends on the one before it, per cluster for HRBP's three
          independent sub-processes). On top of that, exactly these {crossDeskEdges.length} cross-desk dependencies —
          the same three handoffs the function graph names, no extra edge type:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {crossDeskEdges.map((e) => (
            <li key={`${e.fromCode}-${e.toCode}`}>
              <code>{e.fromCode}</code> → <code>{e.toCode}</code> <span className="hint">({e.citedFrom})</span>
            </li>
          ))}
        </ul>
      </div>

      {needsKey && !isGuest && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        {isGuest ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            Sign in (Home → Set up the demo) to actually call <code>POST /genome/import</code> and see the real GQS
            score for this exact payload — it needs a real tenant. Looking only, nothing sent.
          </p>
        ) : (
          <>
            <button type="button" className="primary" disabled={busy} onClick={() => void run()}>
              {busy ? "Importing…" : result ? "Run again" : "Import family (declared)"}
            </button>
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Calls the real, unmodified <code>POST /genome/import</code> — the same endpoint and the same gate every
              genome on this platform goes through.
            </p>
          </>
        )}
      </div>

      {result && (
        <div className={`banner ${result.accepted ? "ok" : "warn"}`} style={{ marginBottom: 16 }}>
          <strong>
            {result.accepted ? "Accepted." : "Not accepted — GQS gate held, as expected for an all-declared family."} GQS{" "}
            {result.gqs.toFixed(2)} / {result.gate_threshold}.
          </strong>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            {result.work_unit_count} Work Units scored. Observed% {String(result.breakdown.observed_pct ?? 0)} — this
            is why: a family built entirely from declared sittings cannot clear a gate that weights Observed% at 40%
            of the score, by the same frozen formula (<code>services/gqs.py</code>) every other genome is scored on.
          </div>
          {result.violations.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {result.violations.map((v, i) => (
                <li key={i}>
                  {v.code}: {v.detail}
                </li>
              ))}
            </ul>
          )}
          <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
            Not accepted means no Work Unit or edge rows were written for this attempt — the units/gaps listed above
            are this payload's own contents, read from the same builder that made the request, not a read of rows
            that don't exist.
          </p>
        </div>
      )}

      <IoPanes
        given="Six DeskSpec sittings, verbatim step lists, one shared handoff map."
        understood="Declared means an interview/sitting claim. This platform has no system-of-record connector, so nothing here can honestly be observed."
        processed="Same POST /genome/import, same GQS>=90 gate as any other tenant's genome. No relaxed path for this family."
        output={
          result
            ? `GQS ${result.gqs.toFixed(2)} / ${result.gate_threshold} — ${result.accepted ? "accepted" : "gate held"}, ${result.work_unit_count} Work Units.`
            : `${payload.work_units.length} Work Units built, not yet imported.`
        }
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/hr/function-graph">← HR function graph</Link>
        {" · "}
        <Link to="/hr/operations">HR operations</Link>
        {" · "}
        <Link to="/scout/offer-desk/evidence-pack">Offer Desk evidence pack (the only path that clears GQS for OD units) →</Link>
      </p>
    </>
  );
}
