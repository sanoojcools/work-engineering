import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";
import type { Page, SpecCheck, WorkUnit } from "../types";

type UploadedEvidence = { file_id: string; sha256: string; file_name: string; size: number };

export default function OfferDeskSpecDeny() {
  const rec = DOCUMENT_CHECK_RECORD;
  const isGuest = useIsGuest();
  const [previewed, setPreviewed] = useState(false);
  const [units, setUnits] = useState<WorkUnit[] | null>(null);
  const [check, setCheck] = useState<SpecCheck | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<UploadedEvidence | null>(null);
  const [clearedCheck, setClearedCheck] = useState<SpecCheck | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const target = useMemo(() => {
    if (!units || units.length === 0) return null;
    return (
      units.find((u) => u.evidence_required.trim().length > 0) ??
      units[0]
    );
  }, [units]);

  async function loadUnits() {
    const page = await apiFetch.get<Page<WorkUnit>>("/work-units/");
    setUnits(page.items);
    return page.items;
  }

  async function askWithoutPass() {
    setBusy(true);
    setError(null);
    setCheck(null);
    setHttpStatus(null);
    try {
      const list = units ?? (await loadUnits());
      const wu =
        list.find((u) => u.evidence_required.trim().length > 0) ?? list[0];
      if (!wu) {
        setError("No contracted Work Unit on this tenant. Set up the demo first. Talk-only did not write Offer Desk into the company list.");
        return;
      }
      const row = await apiFetch.post<SpecCheck>("/spec/check", {
        work_unit_code: wu.code,
        check_type: "evidence",
        caller: "offer-desk-walk",
        approver: wu.authority || wu.owner || "",
        actor: wu.actor_type || "human",
        evidence_ref: "",
        object_state: "",
      });
      setHttpStatus(200);
      setCheck(row);
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) {
        setNeedsKey(true);
      } else {
        setError(err instanceof Error ? err.message : "Spec check failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function clearWithEvidence() {
    if (!target) return;
    setClearing(true);
    setClearError(null);
    try {
      // A real file through the real upload endpoint — server-computed
      // sha256, not a caller-supplied placeholder string. This is the same
      // endpoint offer-desk-inputs/ used to prove the observed path works;
      // this button proves it inline, on the exact unit that just denied.
      const csv = "document_type,status\noffer_letter,verified\naadhaar,verified\npan_card,verified\n";
      const file = new File([csv], "document-check-evidence.csv", { type: "text/csv" });
      const form = new FormData();
      form.append("file", file);
      const uploaded = await apiFetch.postForm<UploadedEvidence>("/files/upload", form);
      setEvidence(uploaded);

      const row = await apiFetch.post<SpecCheck>("/spec/check", {
        work_unit_code: target.code,
        check_type: "evidence",
        caller: "offer-desk-walk",
        approver: target.authority || target.owner || "",
        actor: target.actor_type || "human",
        evidence_ref: uploaded.sha256,
        object_state: "",
      });
      setClearedCheck(row);
    } catch (err) {
      setClearError(err instanceof Error ? err.message : "Could not clear the deny");
    } finally {
      setClearing(false);
    }
  }

  const denied = check && check.result !== "allowed";

  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · ask Spec without a pass
      </p>
      <h2>
        Spec deny{" "}
        <InfoTooltip
          term="Spec"
          simple="Runtime asks the specification whether this action may proceed. Empty proof on a unit that requires evidence is a deny. A crash is not a deny."
        />
      </h2>
      <p className="lede">
        The sitting produced no Work Unit. Spec still has to refuse an empty evidence token on a contracted unit. That refuse is the product moment — not a 500.
      </p>
      <SeatStepper />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>What this sitting can and cannot present</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li>Work items written from talk-only: 0</li>
          <li>Proof on the helper list: local browser state, not evidence_ref</li>
          <li>Zwayam events in this demo: 0</li>
          <li>Contract proof required on the cut: {rec.evidenceRequired}</li>
        </ul>
      </div>

      {needsKey && !isGuest && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        {isGuest ? (
          <>
            <p style={{ fontSize: 13 }}>
              This calls <code>POST /spec/check</code> with <code>check_type: evidence</code> and an empty{" "}
              <code>evidence_ref</code> on the contracted document-check unit — it needs a real tenant, so a guest
              can preview the outcome without the live call rather than hit a 401.
            </p>
            <button type="button" className="primary" onClick={() => setPreviewed(true)}>
              Preview: ask Spec without a pass
            </button>
            <p className="hint" style={{ marginBottom: 0 }}>
              Sign in (Home → Set up the demo) to run this for real and upload evidence.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13 }}>
              Button below calls <code>POST /spec/check</code> with <code>check_type: evidence</code> and an empty <code>evidence_ref</code>
              {target ? <> on <strong>{target.code}</strong> ({target.name})</> : ". Set up the demo so a contracted unit exists."}
            </p>
            <button type="button" className="primary" disabled={busy} onClick={() => void askWithoutPass()}>
              {busy ? "Asking Spec…" : "Ask Spec without a pass"}
            </button>
            {target && (
              <p className="hint" style={{ marginBottom: 0 }}>
                Using a contracted census unit, not the Offer Desk sitting. Talk-only already refused to mint one.
              </p>
            )}
          </>
        )}
      </div>

      {isGuest && previewed && (
        <div className="banner warn" style={{ marginBottom: 16 }}>
          <strong>Preview · denied — evidence_ref required by contract</strong>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            This is what a signed-in run returns, not a live call: the document-check unit's contract requires{" "}
            {rec.evidenceRequired}, and an empty <code>evidence_ref</code> always denies —{" "}
            <code>services/spec.py::enforce</code> only checks whether it's a non-empty string. Sign in to run this
            for real and see the live result.
          </div>
        </div>
      )}

      {!isGuest && check && (
        <div className={`banner ${denied && httpStatus === 200 ? "warn" : "error"}`} style={{ marginBottom: 16 }}>
          <strong>
            HTTP {httpStatus ?? "?"} · {check.result}
            {check.reason ? ` — ${check.reason}` : ""}
          </strong>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            {denied && httpStatus === 200
              ? "Deny. Empty proof. Runtime refused. That is the product."
              : "This walk expects 200 denied. A 500 after a correct deny is the post-commit RLS refresh — rebuild the backend image from idea/v9. Do not rewrite the gate."}
          </div>
        </div>
      )}

      {denied && target && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>What would clear this</h3>
          <p style={{ fontSize: 13 }}>
            This unit's contract requires: <strong>{target.evidence_required || rec.evidenceRequired}</strong>.
            Spec's evidence check (<code>services/spec.py::enforce</code>) only asks one question: is{" "}
            <code>evidence_ref</code> a non-empty string? It does not care what kind of file — but a real one, uploaded
            through the same server-hashing endpoint every genome import uses, is the honest way to clear it, not typing
            a placeholder string into the request.
          </p>
          {!evidence && (
            <>
              <button type="button" className="primary" disabled={clearing} onClick={() => void clearWithEvidence()}>
                {clearing ? "Uploading & re-asking Spec…" : "Upload sample document-check evidence & re-ask Spec"}
              </button>
              <p className="hint" style={{ marginBottom: 0 }}>
                Uploads a small CSV (checklist result: offer letter / Aadhaar / PAN verified) via the real{" "}
                <code>POST /files/upload</code>, then re-runs the same check with that file's server-computed sha256 as{" "}
                <code>evidence_ref</code>.
              </p>
            </>
          )}
          {clearError && <div className="banner error">{clearError}</div>}
          {evidence && (
            <div className="banner ok" style={{ marginTop: 12, marginBottom: 0 }}>
              <div style={{ fontSize: 13 }}>
                Uploaded <strong>{evidence.file_name}</strong> ({evidence.size} bytes) — server-computed{" "}
                <code>sha256 {evidence.sha256.slice(0, 16)}…</code>, a real <code>UploadedFile</code> row, not a string
                typed into the request.
              </div>
              {clearedCheck && (
                <div style={{ marginTop: 8 }}>
                  <strong>
                    HTTP 200 · {clearedCheck.result}
                    {clearedCheck.reason ? ` — ${clearedCheck.reason}` : ""}
                  </strong>
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    Same unit, same check, real <code>evidence_ref</code> this time — the gate did what it says on the tin.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <IoPanes
        given="A contracted Work Unit that requires evidence, and no token."
        understood="Governance by construction: missing proof is not a maybe."
        processed="Existing POST /spec/check. Empty evidence_ref. Gate already set allowed = False. Refresh re-SETs the tenant so deny does not 500."
        output="200 denied, reason evidence_ref required by contract. Sitting still has zero Work Units."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/sitting-record">Close the sitting record →</Link>
      </p>
    </>
  );
}
