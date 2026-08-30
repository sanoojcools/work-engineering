import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { DiscoveryPartner } from "../components/scout/DiscoveryPartner";
import { GenomeStrengthMeter } from "../components/scout/GenomeStrengthMeter";
import { WorkCaptureGrid } from "../components/scout/WorkCaptureGrid";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { INTERVIEW_TYPES } from "../types";
import type { ScoutSession } from "../types";
import { Banner, Loading } from "../ui";

function NewSessionForm({ onCreated, onNeedsKey }: { onCreated: (s: ScoutSession) => void; onNeedsKey: () => void }) {
  const [type, setType] = useState<(typeof INTERVIEW_TYPES)[number]>("sme");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const session = await apiFetch.post<ScoutSession>("/scout/sessions", { type, interviewee_name: name.trim() });
      onCreated(session);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
      else setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3>Start a Scout interview</h3>
      {error && <Banner kind="error">{error}</Banner>}
      <div className="stack">
        <label>
          <span>Track</span>
          <select value={type} onChange={(e) => setType(e.target.value as (typeof INTERVIEW_TYPES)[number])}>
            <option value="founder">Founder</option>
            <option value="sme">SME</option>
          </select>
        </label>
        <label>
          <span>Interviewee name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya N." />
        </label>
        <button type="button" className="primary" disabled={busy || !name.trim()} onClick={create}>
          Start interview &rarr;
        </button>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        No consent step wired in here yet (that's the existing POST /api/consent/receipts — linking it to a new
        session is a follow-up, not this PR).
      </p>
    </div>
  );
}

export default function ScoutInterview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ScoutSession | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(sessionId !== "new");

  async function load(id: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch.get<ScoutSession>(`/scout/sessions/${id}`);
      setSession(data);
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionId && sessionId !== "new") void load(sessionId);
  }, [sessionId]);

  if (sessionId === "new" && !session) {
    return (
      <div>
        <h2>Scout Interview</h2>
        <p className="lede">Elevated discovery interview — Founder or SME track, live capture, completeness meter.</p>
        {needsKey && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
        <NewSessionForm
          onCreated={(s) => {
            setSession(s);
            navigate(`/scout/interview/${s.id}`, { replace: true });
          }}
          onNeedsKey={() => setNeedsKey(true)}
        />
      </div>
    );
  }

  if (needsKey) {
    return (
      <div>
        <h2>Scout Interview</h2>
        <ApiKeyBanner onSaved={() => sessionId && void load(sessionId)} />
      </div>
    );
  }

  if (loading) return <Loading />;
  if (error) return <Banner kind="error">{error}</Banner>;
  if (!session) return <Banner kind="error">Session not found.</Banner>;

  return (
    <div>
      <div
        className="scout-progress-banner"
        style={{
          margin: "-28px -32px 20px", padding: "14px 32px", background: "var(--panel)",
          borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <strong>{session.interviewee_name}</strong>
        <span className="muted">
          {session.type === "founder" ? "Founder track" : "SME track"} &middot; {session.status.replace("_", " ")}
        </span>
        <span className="scout-completeness-summary" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
          You are {session.completeness_pct.toFixed(0)}% to a complete genome
          {session.completeness_pct < 100 && ` — keep filling the grid to close the gap`}
        </span>
      </div>

      <div className="split" style={{ gridTemplateColumns: "1.1fr 1.4fr 1fr", gap: 16 }}>
        <DiscoveryPartner session={session} />
        <WorkCaptureGrid session={session} onChange={setSession} onNeedsKey={() => setNeedsKey(true)} />
        <GenomeStrengthMeter session={session} />
      </div>

      <div className="nudge info" style={{ marginTop: 20 }}>
        <div className="nudge-body">
          <div className="nudge-title">Coming in later PRs</div>
          <div className="nudge-msg" style={{ marginBottom: 0 }}>
            Time-Travel Replay, Contradiction Resolver, Pain Heatmap, Story-to-Structure live trace, and the 100%
            Future Preview unlock are the next 5 elevations (Scout Elevated V2 design doc) — not built in this PR.
          </div>
        </div>
      </div>
    </div>
  );
}
