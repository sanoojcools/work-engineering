import { useEffect, useMemo, useState } from "react";
import { api, errorMessage, getSpecKey, setSpecKey } from "../api";
import { CompanyBanner } from "../components/CompanyBanner";
import { EducationalNudge } from "../components/EducationalNudge";
import { LabelWithInfo } from "../components/InfoTooltip";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import { preferOnb04, simpleDeny } from "../lib/runs";
import type { Page, SpecCheck, WorkUnit } from "../types";
import { CHECK_TYPES } from "../types";
import { Banner, DataTable, Field, Form } from "../ui";

export default function Spec() {
  const { client } = useCompany();
  const units = useApi<Page<WorkUnit>>(withClient("/work-units/", client?.id));
  const [checks, setChecks] = useState<SpecCheck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [key, setKey] = useState(getSpecKey);
  const [last, setLast] = useState<SpecCheck | null>(null);
  const [code, setCode] = useState("");
  const [checkType, setCheckType] = useState<(typeof CHECK_TYPES)[number]>("authority");
  const [approver, setApprover] = useState("");
  const [evidence, setEvidence] = useState("MSG-123");
  const [objectState, setObjectState] = useState("");
  const [showDenyHelp, setShowDenyHelp] = useState(false);

  const items = units.data?.items ?? [];
  const unit = useMemo(() => items.find((u) => u.code === code) ?? preferOnb04(items), [items, code]);
  const expectedApprover = unit?.authority || unit?.owner || "HR Ops SPOC";

  useEffect(() => {
    if (code || items.length === 0) return;
    const preferred = preferOnb04(items);
    if (preferred) setCode(preferred.code);
  }, [items, code]);

  useEffect(() => {
    if (!unit) return;
    setApprover(unit.authority || unit.owner || "HR Ops SPOC");
    if (checkType === "condition") setObjectState(unit.current_condition);
    if (checkType === "acceptance") setObjectState(unit.desired_condition);
  }, [unit, checkType]);

  async function withKey<T>(fn: (specKey: string) => Promise<T>): Promise<T> {
    setSpecKey(key);
    return fn(key);
  }

  async function refreshChecks() {
    setError(null);
    try {
      const page = await withKey((specKey) => api.get<Page<SpecCheck>>("/spec/checks", specKey));
      setChecks(page.items);
      setLoaded(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const denyFix = last && last.result !== "allowed" ? simpleDeny(last.reason, expectedApprover) : null;

  return (
    <>
      <h2>
        <LabelWithInfo label="Spec API">Spec API</LabelWithInfo>
      </h2>
      <p className="lede">
        Execution systems consume the specification. Governance by construction: if the runtime
        cannot present authority, evidence, or the right object state, the check is denied.
      </p>
      <CompanyBanner />
      {error && <Banner kind="error">{error}</Banner>}
      {info && <Banner kind="ok">{info}</Banner>}
      {last && (
        <Banner kind={last.result === "allowed" ? "ok" : "error"}>
          {last.check_type}: {last.result}{last.reason ? ` — ${last.reason}` : ""}
        </Banner>
      )}
      {denyFix && showDenyHelp && (
        <EducationalNudge
          title="DENY = governance working"
          message={denyFix}
          onDismiss={() => setShowDenyHelp(false)}
          type="warning"
        />
      )}

      <section className="card">
        <h3>
          <LabelWithInfo label="X-Spec-Key">Shared secret</LabelWithInfo>
        </h3>
        <p className="muted">Sent as X-Spec-Key. Default matches .env.example.</p>
        <div className="toolbar">
          <input value={key} onChange={(e) => setKey(e.target.value)} style={{ minWidth: 280 }} />
          <button onClick={() => void refreshChecks()}>List checks</button>
        </div>
      </section>

      <section className="card" data-tour="spec-api">
        <h3>Enforcement check</h3>
        <p className="hint">
          Selected owner: <strong>{unit?.owner || "—"}</strong>. Approver auto-fills to the unit
          authority (HR Ops SPOC for WU-ONB-04), not Order Desk.
        </p>
        <Form
          onSubmit={async () => {
            setError(null);
            setInfo(null);
            try {
              const row = await withKey((specKey) =>
                api.post<SpecCheck>(
                  "/spec/check",
                  {
                    work_unit_code: code,
                    check_type: checkType,
                    caller: "ui",
                    approver,
                    actor: unit?.actor_type || "agent",
                    evidence_ref: evidence,
                    object_state: objectState,
                  },
                  specKey,
                ),
              );
              setLast(row);
              setInfo(row.result === "allowed" ? "Allowed" : "Denied");
              setShowDenyHelp(row.result !== "allowed");
              await refreshChecks();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label={<LabelWithInfo label="Work Unit">Work Unit code</LabelWithInfo>}>
            <select name="work_unit_code" required value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="">Select</option>
              {items.map((u) => (
                <option key={u.id} value={u.code}>{u.code} · {u.name}</option>
              ))}
            </select>
          </Field>
          <Field label={<LabelWithInfo label="Authority check">Check type</LabelWithInfo>}>
            <select
              name="check_type"
              value={checkType}
              onChange={(e) => setCheckType(e.target.value as (typeof CHECK_TYPES)[number])}
            >
              <option value="authority">authority — Who can say OK?</option>
              <option value="evidence">evidence — Do you have proof?</option>
              <option value="condition">condition — Is object ready to START?</option>
              <option value="acceptance">acceptance — Is object DONE?</option>
            </select>
          </Field>
          <Field label={<LabelWithInfo label="Authority / Owner">Approver / authority token</LabelWithInfo>}>
            <input name="approver" value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="HR Ops SPOC" />
            <span className="hint">For WU-ONB-04 use HR Ops SPOC, not Order Desk.</span>
          </Field>
          <Field label={<LabelWithInfo label="Evidence / Evidence Ref">Evidence ref</LabelWithInfo>}>
            <input name="evidence_ref" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="MSG-123" />
            <span className="hint">Example: MSG-123 or OUTLOOK-MSG-123 + TEAMS-INV-678</span>
          </Field>
          <Field label={<LabelWithInfo label="Object State">Object state</LabelWithInfo>} span2>
            <input
              name="object_state"
              value={objectState}
              onChange={(e) => setObjectState(e.target.value)}
              placeholder={unit?.desired_condition || "Welcome mail status = delivered"}
            />
            <span className="hint">
              Condition example: {unit?.current_condition || "Offer status = signed in Zoho"}.
              Acceptance example: {unit?.desired_condition || "Welcome mail status = delivered"}.
            </span>
          </Field>
          <button className="primary" type="submit">Check</button>
        </Form>
        <div className="allow-box">
          <strong>
            <LabelWithInfo label="ALLOW / DENY">Expected ALLOW examples</LabelWithInfo>
          </strong>
          <ul>
            <li>authority + Approver = {expectedApprover} → ALLOW</li>
            <li>evidence + Evidence ref = MSG-123 → ALLOW</li>
            <li>condition + Object state = {unit?.current_condition || "Offer status = signed in Zoho"} → ALLOW</li>
            <li>acceptance + Object state = {unit?.desired_condition || "Welcome mail status = delivered"} → ALLOW</li>
          </ul>
        </div>
        <div className="deny-box">
          <strong>Common DENY fixes (simple words)</strong>
          <ul>
            <li>You used the wrong approver. This work needs {expectedApprover}, not Order Desk.</li>
            <li>You left proof empty. Add MSG-123 (or the evidence the contract asks for).</li>
            <li>Object is not ready to START. Paste the Current Condition into Object state.</li>
            <li>Object is not DONE. Paste the Desired Condition into Object state.</li>
          </ul>
        </div>
      </section>

      <h3>Recent checks</h3>
      {!loaded && <p className="muted">Load checks with the spec key to see the audit trail.</p>}
      {loaded && (
        <DataTable
          rows={checks}
          columns={[
            { key: "work_unit_id", header: "Unit id" },
            { key: "check_type", header: "Type" },
            { key: "result", header: "Result" },
            { key: "reason", header: "Reason" },
            { key: "caller", header: "Caller" },
          ]}
        />
      )}
    </>
  );
}
