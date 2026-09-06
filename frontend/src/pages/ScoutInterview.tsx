import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { ContradictionResolver } from "../components/scout/ContradictionResolver";
import { DiscoveryPartner } from "../components/scout/DiscoveryPartner";
import { FuturePreview } from "../components/scout/FuturePreview";
import { GenomeStrengthMeter } from "../components/scout/GenomeStrengthMeter";
import { PainHeatmap } from "../components/scout/PainHeatmap";
import { StoryToStructure, type StoryChunk } from "../components/scout/StoryToStructure";
import { TimeTravelReplay } from "../components/scout/TimeTravelReplay";
import { WorkCaptureGrid } from "../components/scout/WorkCaptureGrid";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { INTERVIEW_TYPE_LABELS, INTERVIEW_TYPES } from "../types";
import type { ScoutSession } from "../types";
import { Banner, Loading } from "../ui";

function NewSessionForm({
  type, setType, name, setName, busy, error, onSubmit,
}: {
  type: (typeof INTERVIEW_TYPES)[number];
  setType: (t: (typeof INTERVIEW_TYPES)[number]) => void;
  name: string;
  setName: (n: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h3>Start a Scout interview</h3>
      {error && <Banner kind="error">{error}</Banner>}
      <div className="stack">
        <label>
          <span>Track</span>
          <select value={type} onChange={(e) => setType(e.target.value as (typeof INTERVIEW_TYPES)[number])}>
            {INTERVIEW_TYPES.map((t) => (
              <option key={t} value={t}>{INTERVIEW_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Interviewee name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            placeholder="Priya N."
          />
        </label>
        <button type="button" className="primary" disabled={busy || !name.trim()} onClick={onSubmit}>
          {busy ? "Starting…" : "Start interview →"}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Consent is confirmed later, right before you generate a genome from this session — not required to start
        capturing work here.
      </p>
    </div>
  );
}

export default function ScoutInterview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<ScoutSession | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(sessionId !== "new");

  // The Function Scope grid's "Start interview" button navigates here with
  // this state to hand off a sub-function's assigned owner into the create
  // form -- a pre-fill, not an automatic cascade (nothing is created until
  // the interviewer presses Start below).
  const prefill = location.state as { prefillType?: string; prefillName?: string } | null;

  // Lifted out of NewSessionForm so a key-banner retry can re-submit the
  // same track/name the interviewer already typed, instead of clearing the
  // form or making them click Start a second time.
  // Defaults to function_head: the natural first session in the top-down
  // flow (CHRO/function head -> sub-function lead -> SME) this three-layer
  // model exists to support.
  const [type, setType] = useState<(typeof INTERVIEW_TYPES)[number]>(
    (prefill?.prefillType as (typeof INTERVIEW_TYPES)[number] | undefined) ?? "function_head"
  );
  const [name, setName] = useState(prefill?.prefillName ?? "");
  const [creating, setCreating] = useState(false);

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

  async function createSession() {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const s = await apiFetch.post<ScoutSession>("/scout/sessions", { type, interviewee_name: name.trim() });
      setNeedsKey(false);
      setSession(s);
      navigate(`/scout/interview/${s.id}`, { replace: true });
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (sessionId && sessionId !== "new") void load(sessionId);
  }, [sessionId]);

  if (sessionId === "new" && !session) {
    return (
      <div>
        <h2>Scout Interview</h2>
        <p className="lede">Elevated discovery interview — Function Head, Sub-function Lead, or SME track, live capture, completeness meter.</p>
        {needsKey && <ApiKeyBanner onSaved={createSession} />}
        <NewSessionForm
          type={type} setType={setType}
          name={name} setName={setName}
          busy={creating} error={error}
          onSubmit={() => void createSession()}
        />
      </div>
    );
  }

  if (needsKey) {
    return (
      <div>
        <h2>Scout Interview</h2>
        <ApiKeyBanner onSaved={() => (sessionId ? load(sessionId) : Promise.resolve())} />
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
          {INTERVIEW_TYPE_LABELS[session.type]} track &middot; {session.status.replace("_", " ")}
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

      <ElevationModules session={session} onNeedsKey={() => setNeedsKey(true)} onChange={setSession} />
    </div>
  );
}

const ELEVATIONS = [
  "Time-Travel Replay",
  "Contradiction Resolver",
  "Pain Heatmap",
  "Story to Structure",
  "Future Preview",
] as const;

/** One plain-language sentence per elevation, shown the same way in the same
 * place every time -- so "what is this and why should I care" never depends
 * on reading the more technical copy each panel already has below it. */
const ELEVATION_EXPLAINERS: Record<(typeof ELEVATIONS)[number], string> = {
  "Time-Travel Replay":
    "Lays out everything captured so far on a clock for a normal working day, so you can see at a glance " +
    "which hours are accounted for and which are still empty.",
  "Contradiction Resolver":
    "When two people describe the same work unit differently, this shows both answers side by side so a " +
    "human — not the app — decides which one is true.",
  "Pain Heatmap":
    "Ranks the systems mentioned in the interview by how much frustration and time they cost, so the worst " +
    "offenders are obvious before you go looking for them.",
  "Story to Structure":
    "Turns a paragraph of someone describing their day into individual rows for the grid above, so a real " +
    "interview doesn't have to be manually broken apart by hand.",
  "Future Preview":
    "A locked look at what this session would add to the Genome once it's complete — a taste of the payoff, " +
    "held back until there's enough real detail captured to earn it.",
};

function ElevationModules({
  session,
  onNeedsKey,
  onChange,
}: {
  session: ScoutSession;
  onNeedsKey: () => void;
  onChange: (s: ScoutSession) => void;
}) {
  const [open, setOpen] = useState<(typeof ELEVATIONS)[number] | null>(null);

  /** An extracted span becomes a real captured unit through the same endpoint
   * the grid uses — so it is subject to the same completeness recomputation,
   * and carries no marker claiming it was machine-derived beyond what the
   * fields themselves say. */
  async function addExtracted(chunk: StoryChunk) {
    const created = await apiFetch.post<ScoutSession>(`/scout/sessions/${session.id}/units`, {
      name: chunk.suggested_name || chunk.text.slice(0, 80),
      inputs: chunk.inputs ?? "",
      outputs: chunk.outputs ?? "",
      systems: chunk.systems ?? "",
      frequency: chunk.frequency ?? "",
      pain: chunk.pain ?? "",
      handoffs: chunk.handoffs ?? "",
      decision_rule: chunk.decision_rule ?? "",
      time_minutes: chunk.time_minutes ?? null,
    });
    onChange(created);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div className="tabs">
        {ELEVATIONS.map((name) => (
          <button key={name} aria-selected={open === name} onClick={() => setOpen(open === name ? null : name)}>
            {name}
          </button>
        ))}
      </div>
      {open && (
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>{open}</h3>
          <p className="lede" style={{ marginTop: 0, marginBottom: 14 }}>{ELEVATION_EXPLAINERS[open]}</p>
          {open === "Time-Travel Replay" && <TimeTravelReplay sessionId={session.id} onNeedsKey={onNeedsKey} />}
          {open === "Contradiction Resolver" && (
            <ContradictionResolver sessionId={session.id} onNeedsKey={onNeedsKey} />
          )}
          {open === "Pain Heatmap" && <PainHeatmap sessionId={session.id} onNeedsKey={onNeedsKey} />}
          {open === "Story to Structure" && <StoryToStructure onNeedsKey={onNeedsKey} onAdd={addExtracted} />}
          {open === "Future Preview" && (
            <FuturePreview session={session} onNeedsKey={onNeedsKey} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
}
