import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";
import { V10 } from "../../lib/v10Terms";
import type { ScoutSession } from "../../types";
import { Banner } from "../../ui";
import { InfoTooltip } from "../InfoTooltip";
import { ConsentGate } from "./ConsentGate";

type Preview = {
  completeness_pct: number;
  unlocked: boolean;
  time_saved_min_per_day: number;
  business_objects_preview: string[];
  unit_count: number;
};

type GenerateResult = {
  accepted: boolean;
  version_id: number;
  sequence: number;
  gqs: number;
  work_unit_count: number;
  violations: { code?: string; detail?: string }[];
};

export function FuturePreview({
  session,
  onNeedsKey,
  onChange,
}: {
  session: ScoutSession;
  onNeedsKey: () => void;
  onChange: (s: ScoutSession) => void;
}) {
  const sessionId = session.id;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const p = await apiFetch.get<Preview>(`/scout/sessions/${sessionId}/future-preview`);
      setPreview(p);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function generate() {
    setBusy(true);
    setResult(null);
    setGenError(null);
    try {
      const r = await apiFetch.post<GenerateResult>(`/scout/sessions/${sessionId}/generate-genome`);
      setResult(r);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
      else setGenError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!preview) return <p className="health">Loading…</p>;

  if (!session.consent_receipt_id) {
    return <ConsentGate session={session} onNeedsKey={onNeedsKey} onAttached={onChange} />;
  }

  const locked = !preview.unlocked;
  const save = V10.saveDraft;
  const sit = V10.sittingComplete;
  const gate = V10.filesNotEnough;
  const rec = V10.workRecord;
  const prev = V10.draftPreview;

  return (
    <div>
      <p className="lede" style={{ marginTop: 0 }}>
        {prev.label}{" "}
        <InfoTooltip term={prev.term} simple={prev.simple} technical={prev.technical} />
      </p>
      <div
        style={{
          filter: locked ? "blur(4px)" : "none",
          opacity: locked ? 0.6 : 1,
          transition: "filter 0.4s, opacity 0.4s",
          pointerEvents: locked ? "none" : "auto",
        }}
      >
        <div className="metrics" style={{ marginBottom: 16 }}>
          <div className="metric">
            <div className="n">{preview.unit_count}</div>
            <div className="l">Pieces captured</div>
          </div>
          <div className="metric">
            <div className="n">{preview.business_objects_preview.length}</div>
            <div className="l">Things this work is about</div>
          </div>
          <div className="metric">
            <div className="n">{(preview.time_saved_min_per_day / 60).toFixed(1)}h</div>
            <div className="l">Potential time saved / day</div>
          </div>
          <div className="metric">
            <div className="n">{preview.completeness_pct.toFixed(0)}%</div>
            <div className="l">
              {sit.label} <InfoTooltip term={sit.term} simple={sit.simple} technical={sit.technical} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {preview.business_objects_preview.map((name) => (
            <span key={name} className="badge ok">{name}</span>
          ))}
        </div>

        <button type="button" className="primary" disabled={busy || locked} onClick={generate}>
          {save.label}
        </button>
        <InfoTooltip term={save.term} simple={save.simple} technical={save.technical} />

        {genError && <Banner kind="error">{genError}</Banner>}

        {result && (
          <div className={`banner ${result.accepted ? "ok" : "warn"}`} style={{ marginTop: 12 }}>
            {result.accepted ? (
              <>
                {rec.label} v{result.sequence} saved.{" "}
                <InfoTooltip term={rec.term} simple={rec.simple} technical={rec.technical} />{" "}
                {result.work_unit_count} piece(s).{" "}
              </>
            ) : (
              <>
                {gate.label} Score {result.gqs.toFixed(1)}.{" "}
                <InfoTooltip term={gate.term} simple={gate.simple} technical={gate.technical} />{" "}
                This is not a broken screen.{" "}
              </>
            )}
            <Link to={`/genome/${result.version_id}`}>Open work record v{result.sequence} →</Link>
          </div>
        )}
      </div>

      {locked && (
        <div style={{ textAlign: "center", marginTop: -90, position: "relative", zIndex: 1 }}>
          <div style={{ background: "#fff", border: "1px solid var(--line)", display: "inline-block", padding: "14px 20px" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Fill this sitting grid to unlock</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {(100 - preview.completeness_pct).toFixed(0)} points to go on the pieces captured table.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
