import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import {
  OFFER_DESK_AUTOMATION_SUMMARY,
  OFFER_DESK_EXCEPTIONS,
  OFFER_DESK_HANDOFFS,
  OFFER_DESK_META,
  OFFER_DESK_SAMPLE_ROWS,
  OFFER_DESK_STEPS,
  OFFER_DESK_TOTAL_SAVINGS,
  splitOfferDeskDataFields as splitDataFields,
  type OfferDeskStep,
} from "../lib/offerDeskData";
import type { ScoutSession } from "../types";

const AUTOMATION_COLOR: Record<string, string> = {
  "Fully automatable": "var(--good)",
  "Partially automatable": "#8a6d2f",
  "Manual (judgment)": "var(--danger)",
};

function automationColor(tag: string): string {
  return AUTOMATION_COLOR[tag] ?? "var(--muted)";
}

function StepCard({ s }: { s: OfferDeskStep }) {
  const { input, output } = splitDataFields(s.dataFieldsRaw);
  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff",
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}
          >
            {s.step}
          </span>
          <strong style={{ fontSize: 14 }}>{s.system}</strong>
          <span className="hint" style={{ marginTop: 0 }}>{s.stepType}</span>
        </div>
        <span className="badge" style={{ borderColor: automationColor(s.automationTag), color: automationColor(s.automationTag) }}>
          {s.automationTag}
        </span>
      </div>

      <p style={{ fontSize: 13, marginBottom: 12, whiteSpace: "pre-line" }}>{s.whatHappens}</p>

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ border: "1px solid var(--line)", padding: 10, background: "var(--panel-sunk)" }}>
          <div className="hint" style={{ marginTop: 0, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>
            Input — what comes in
          </div>
          {input.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>Nothing read at this step.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
              {input.map((l, i) => <li key={i} style={{ marginBottom: 3 }}>{l}</li>)}
            </ul>
          )}
        </div>
        <div style={{ border: "1px solid var(--line)", padding: 10, background: "var(--panel-sunk)" }}>
          <div className="hint" style={{ marginTop: 0, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>
            Output — what goes out
          </div>
          {output.length === 0 ? (
            <div className="muted" style={{ fontSize: 12 }}>Nothing written at this step.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
              {output.map((l, i) => <li key={i} style={{ marginBottom: 3 }}>{l}</li>)}
            </ul>
          )}
        </div>
      </div>

      {s.decisionBranches.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="hint" style={{ marginTop: 0, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>
            Rules applied
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
            {s.decisionBranches.map((l, i) => <li key={i} style={{ marginBottom: 3 }}>{l}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11.5, marginBottom: 12 }} className="muted">
        <span><strong>Time:</strong> {s.timePerCase}</span>
        <span>·</span>
        <span><strong>Frequency:</strong> {s.frequency}</span>
        <span>·</span>
        <span><strong>Volume:</strong> {s.volumePerMonth}</span>
        <span>·</span>
        <span><strong>Wait:</strong> {s.waitCycleTime}</span>
      </div>

      {s.docsPolicies.length > 0 && (
        <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {s.docsPolicies.map((d, i) => <span key={i} className="badge">{d}</span>)}
        </div>
      )}

      <div className="nudge info" style={{ margin: 0 }}>
        <div className="nudge-body">
          <div className="nudge-title">What the platform adds here</div>
          <div className="nudge-msg" style={{ marginBottom: 0 }}>{s.agentNotes}</div>
        </div>
      </div>
    </div>
  );
}

function RunOnPlatform() {
  const navigate = useNavigate();
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const session = await apiFetch.post<ScoutSession>("/scout/sessions", {
        type: "sme",
        interviewee_name: "Rashmi KN (Offer Desk)",
      });
      setNeedsKey(false);
      // Sequential, not Promise.all: each POST recomputes completeness
      // from the units already on the session, so unit N+1 has to land
      // after unit N is committed, not race it.
      for (const row of OFFER_DESK_SAMPLE_ROWS) {
        await apiFetch.post<ScoutSession>(`/scout/sessions/${session.id}/units`, row);
      }
      navigate(`/scout/interview/${session.id}`);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent-edge)" }}>
      <h3>Run this on the platform</h3>
      <p style={{ fontSize: 13, marginBottom: 10 }}>
        Everything above is a read-only page. This button creates a real Scout session and captures all 11 steps as
        real Work Capture Grid rows through the same <code style={{ fontSize: 12 }}>POST /scout/sessions/units</code>{" "}
        call any interviewer uses — so the completeness meter and every dimension breakdown you land on next are the
        platform's own numbers, computed from this data, not this page's.
      </p>
      <p className="hint" style={{ marginBottom: 12 }}>
        It will not reach 100% completeness, on purpose: the transcript states a pain point for only 5 of the 11
        steps and step 1 has no output field at all, so those gaps show up honestly as real dimension gaps rather
        than filled in to look tidier. "Generate V8 Work Units" stays locked below 100%, same rule every Scout
        session faces — the accurate result of this run is the completeness breakdown itself, showing exactly which
        real gaps a follow-up interview would need to close, not a genome. See{" "}
        <code style={{ fontSize: 11.5 }}>docs/HONESTY.md</code> for the same discipline elsewhere in the product.
      </p>
      {needsKey && <ApiKeyBanner onSaved={run} />}
      {error && <div className="banner error" style={{ marginBottom: 12 }}>{error}</div>}
      <button type="button" className="primary" disabled={busy} onClick={() => void run()}>
        {busy ? `Capturing ${OFFER_DESK_SAMPLE_ROWS.length} steps…` : "Generate a real Scout session from this →"}
      </button>
    </div>
  );
}

export default function OfferDesk() {
  const meta = OFFER_DESK_META;
  return (
    <div>
      <p className="hint" style={{ marginBottom: 4 }}>
        HR → Talent Acquisition → Offer Management (worked example) · handoff also touches People Operations → Onboarding
      </p>
      <h2>{meta.workflowName}</h2>
      <p className="lede">
        Every step below shows exactly what data goes in, what happens to it, and what data comes out — pulled directly
        from a real interview transcript, not summarized or guessed. Nothing is hidden in between.
      </p>

      <RunOnPlatform />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="split" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Outcome</div>
            <p style={{ fontSize: 13, margin: 0 }}>{meta.outcome}</p>
          </div>
          <div>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Trigger</div>
            <p style={{ fontSize: 13, margin: 0 }}>{meta.trigger}</p>
          </div>
          <div>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Frequency &amp; SLA</div>
            <p style={{ fontSize: 13, margin: 0 }}>{meta.frequency}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, fontSize: 12.5 }} className="muted">
          <span><strong>Primary SPOC:</strong> {meta.primarySpoc}</span>
          <span><strong>Backup:</strong> {meta.backup}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {meta.systems.map((s, i) => <span key={i} className="badge">{s.split(" (")[0]}</span>)}
        </div>
        <p className="hint" style={{ marginBottom: 0, marginTop: 10 }}>
          Source: {meta.interviewSource}. Category as recorded by the interviewer: "{meta.category}".
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Automation readiness — what the platform is worth here</h3>
        <div className="banner ok" style={{ marginBottom: 12 }}>
          Total estimated savings: <strong>{OFFER_DESK_TOTAL_SAVINGS}</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {OFFER_DESK_AUTOMATION_SUMMARY.map((c, i) => (
            <div key={i} style={{ border: "1px solid var(--line)", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <strong style={{ fontSize: 12.5 }}>{c.category}</strong>
                <span className="badge">{c.pct}</span>
              </div>
              <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>{c.steps}</p>
              <p style={{ fontSize: 12, margin: "0 0 6px" }}>{c.agentAction}</p>
              <p style={{ fontSize: 12, margin: 0 }}><strong>{c.timeSaved}</strong></p>
              <p className="hint" style={{ marginBottom: 0 }}>{c.priority}</p>
            </div>
          ))}
        </div>
      </div>

      <h3>The 11 micro-steps, end to end</h3>
      <div className="stack" style={{ gap: 14, marginBottom: 24 }}>
        {OFFER_DESK_STEPS.map((s) => <StepCard key={s.step} s={s} />)}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Handoff map</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: 6 }}>From</th>
                <th style={{ padding: 6 }}>To</th>
                <th style={{ padding: 6 }}>What is passed</th>
                <th style={{ padding: 6 }}>Format</th>
                <th style={{ padding: 6 }}>Trigger</th>
                <th style={{ padding: 6 }}>Agent potential</th>
              </tr>
            </thead>
            <tbody>
              {OFFER_DESK_HANDOFFS.map((h, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line-faint)" }}>
                  <td style={{ padding: 6 }}>{h.from}</td>
                  <td style={{ padding: 6 }}>{h.to}</td>
                  <td style={{ padding: 6 }}>{h.whatIsPassed}</td>
                  <td style={{ padding: 6 }}>{h.format}</td>
                  <td style={{ padding: 6 }}>{h.trigger}</td>
                  <td style={{ padding: 6 }} className="muted">{h.agentPotential}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Exception catalog</h3>
        <div className="stack" style={{ gap: 10 }}>
          {OFFER_DESK_EXCEPTIONS.map((e) => (
            <div key={e.n} style={{ border: "1px solid var(--line)", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{e.n}. {e.exception}</strong>
                <span className="badge">{e.frequency}</span>
              </div>
              <p style={{ fontSize: 12.5, margin: "0 0 4px" }}><strong>Today:</strong> {e.currentHandling}</p>
              <p className="hint" style={{ marginTop: 0, marginBottom: 4 }}>Escalation: {e.escalation}</p>
              <p style={{ fontSize: 12.5, margin: 0, color: "var(--accent-ink)" }}>{e.agentRecommendation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
