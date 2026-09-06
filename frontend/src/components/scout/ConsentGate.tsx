import { useEffect, useState } from "react";
import { errorMessage } from "../../api";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";
import type { ConsentReceipt, Page, ScoutSession } from "../../types";
import { Banner } from "../../ui";
import { InfoTooltip } from "../InfoTooltip";
import { IoPanes } from "../IoPanes";

/** Slice 2.1: gates "Generate V8 Work Units" (see FuturePreview.tsx) behind
 * a real consent record. The API already 4xx's a generate-genome call with
 * no receipt attached (routers/scout.py) -- this screen exists so an
 * interviewer never has to hit that error to find out, and never has to
 * know it as "consent_receipt_id" to get past it. */
export function ConsentGate({
  session,
  onNeedsKey,
  onAttached,
}: {
  session: ScoutSession;
  onNeedsKey: () => void;
  onAttached: (s: ScoutSession) => void;
}) {
  const [receipts, setReceipts] = useState<ConsentReceipt[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState(session.interviewee_name);
  const [purpose, setPurpose] = useState("Scout discovery interview — understanding day-to-day work for the Work Genome.");
  const [initials, setInitials] = useState("");
  const [retentionDays, setRetentionDays] = useState(90);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const page = await apiFetch.get<Page<ConsentReceipt>>("/consent/receipts");
      setReceipts(page.items.filter((r) => r.status === "active"));
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attach(receiptId: number) {
    setBusy(true);
    setError(null);
    try {
      const s = await apiFetch.patch<ScoutSession>(`/scout/sessions/${session.id}/consent-receipt`, {
        consent_receipt_id: receiptId,
      });
      onAttached(s);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function createAndAttach() {
    if (!subjectId.trim() || !purpose.trim() || !confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const receipt = await apiFetch.post<ConsentReceipt>("/consent/receipts", {
        subject_id: subjectId.trim(),
        purpose: purpose.trim(),
        data_principal_initials: initials.trim(),
        consent_text: "Interviewer confirmed verbal agreement before this session's answers were used.",
        retention_days: retentionDays,
      });
      await attach(receipt.id);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 0 }}>
        Before we turn this into work units
        <InfoTooltip
          term="Consent record"
          simple="A short record that the person you interviewed agreed their answers could be used — who agreed, what for, and how long we keep it. Nothing is generated from a live interview without one."
          technical="consent_receipt_id, required on every genome generated from a Scout session (POST /api/consent/receipts)."
        />
      </h3>
      <p className="lede" style={{ marginTop: 0 }}>
        {session.interviewee_name} needs to have agreed to this before their answers can become part of the
        genome. Pick a record already on file, or create one now — it takes under a minute.
      </p>

      {error && <Banner kind="error">{error}</Banner>}

      {receipts && receipts.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h4 style={{ marginTop: 0 }}>Use a record already on file</h4>
          <div className="stack">
            {receipts.map((r) => (
              <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
                <input
                  type="radio"
                  name="consent-receipt"
                  checked={selected === r.id}
                  onChange={() => setSelected(r.id)}
                />
                <span>
                  {r.subject_id} — {r.purpose}{" "}
                  <span className="muted">(agreed {new Date(r.consented_at).toLocaleDateString()})</span>
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="primary"
            style={{ marginTop: 10 }}
            disabled={busy || selected === null}
            onClick={() => selected !== null && void attach(selected)}
          >
            {busy ? "Attaching…" : "Use this record"}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Or create a new consent record</h4>
        <div className="stack">
          <label>
            <span>Who agreed to this</span>
            <input value={subjectId} onChange={(e) => setSubjectId(e.target.value)} placeholder="Priya N." />
          </label>
          <label>
            <span>What we told them it's for</span>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} />
          </label>
          <label>
            <span>Their initials (optional — never a full name)</span>
            <input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="P.N." maxLength={10} />
          </label>
          <label>
            <span>Keep this record for (days)</span>
            <input
              type="number"
              min={1}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value) || 90)}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>They said yes to this, out loud, before we started.</span>
          </label>
          <button
            type="button"
            className="primary"
            disabled={busy || !subjectId.trim() || !purpose.trim() || !confirmed}
            onClick={() => void createAndAttach()}
          >
            {busy ? "Saving…" : "Save record and continue"}
          </button>
        </div>
      </div>

      <IoPanes
        given="An interviewee who has agreed, in plain words, that their answers can be used — confirmed before this screen, not assumed."
        understood="A consent record: who agreed, what we told them it was for, and how long we keep it. The same record the server checks for every genome built from a live interview."
        processed="We save that record (or reuse one already on file) and attach it to this session. Nothing else about what was captured changes."
        output="A genome can now be generated from this session. Without this step, the server refuses the request outright."
      />
    </div>
  );
}
