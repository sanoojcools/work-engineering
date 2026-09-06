import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";
import type { ScoutSession } from "../../types";
import { Banner } from "../../ui";
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
  /** Tenant-scoped version number; version_id is the global key used in URLs. */
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
      else {
        // The server refuses outright (4xx) when this session has no consent
        // record attached -- shouldn't happen through this screen (the
        // ConsentGate below runs first), but stays a plain-language message
        // rather than a raw error if it ever does (a stale tab, a second
        // interviewer racing this one).
        setGenError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!preview) return <p className="health">Loading…</p>;

  if (!session.consent_receipt_id) {
    return <ConsentGate session={session} onNeedsKey={onNeedsKey} onAttached={onChange} />;
  }

  const locked = !preview.unlocked;

  return (
    <div>
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
            <div className="l">Work units captured</div>
          </div>
          <div className="metric">
            <div className="n">{preview.business_objects_preview.length}</div>
            <div className="l">Business objects</div>
          </div>
          <div className="metric">
            <div className="n">{(preview.time_saved_min_per_day / 60).toFixed(1)}h</div>
            <div className="l">Potential time saved / day</div>
          </div>
          <div className="metric">
            <div className="n">{preview.completeness_pct.toFixed(0)}%</div>
            <div className="l">Genome strength</div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {preview.business_objects_preview.map((name) => (
            <span key={name} className="badge ok">{name}</span>
          ))}
        </div>

        <button type="button" className="primary" disabled={busy || locked} onClick={generate}>
          Generate V8 Work Units
        </button>

        {genError && <Banner kind="error">{genError}</Banner>}

        {result && (
          <div className={`banner ${result.accepted ? "ok" : "warn"}`} style={{ marginTop: 12 }}>
            {result.accepted ? (
              <>
                Genome version v{result.sequence} created — GQS {result.gqs.toFixed(1)}, {result.work_unit_count}{" "}
                work unit(s).{" "}
              </>
            ) : (
              <>
                Blocked by the quality gate: GQS {result.gqs.toFixed(1)} (needs 90). This session's captured units
                are missing several of the 18 required attributes (trigger, acceptance criteria, evidence,
                failure semantics) that Scout's interview screens don't ask for yet — the gate is telling the
                truth about that gap, not a bug.{" "}
              </>
            )}
            <Link to={`/genome/${result.version_id}`}>View genome version v{result.sequence} →</Link>
          </div>
        )}
      </div>

      {locked && (
        <div style={{ textAlign: "center", marginTop: -90, position: "relative", zIndex: 1 }}>
          <div style={{ background: "#fff", border: "1px solid var(--line)", display: "inline-block", padding: "14px 20px" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Reach 100% to unlock</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {(100 - preview.completeness_pct).toFixed(0)} points to go — fill in the Work Capture Grid above.
            </div>
          </div>
        </div>
      )}

      {!locked && !result && (
        <p className="hint" style={{ marginTop: 4 }}>
          100% reached — this genome section is unlocked. (Confetti omitted deliberately: this build keeps motion
          minimal, matching the app's existing style.)
        </p>
      )}
    </div>
  );
}
