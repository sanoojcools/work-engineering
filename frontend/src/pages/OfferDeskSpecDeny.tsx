import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { DOCUMENT_CHECK_RECORD } from "../lib/offerDeskWorkRecord";
import type { Page, SpecCheck, WorkUnit } from "../types";

export default function OfferDeskSpecDeny() {
  const rec = DOCUMENT_CHECK_RECORD;
  const [units, setUnits] = useState<WorkUnit[] | null>(null);
  const [check, setCheck] = useState<SpecCheck | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {needsKey && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
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
      </div>

      {check && (
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
