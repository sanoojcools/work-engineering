import { useState } from "react";
import { api, errorMessage, getSpecKey, setSpecKey } from "../api";
import { useApi } from "../hooks";
import type { Page, SpecCheck, WorkUnit } from "../types";
import { CHECK_TYPES } from "../types";
import { Banner, DataTable, Field, Form } from "../ui";

export default function Spec() {
  const units = useApi<Page<WorkUnit>>("/work-units/");
  const [checks, setChecks] = useState<SpecCheck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [key, setKey] = useState(getSpecKey);
  const [last, setLast] = useState<SpecCheck | null>(null);

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

  return (
    <>
      <h2>Spec API</h2>
      <p className="lede">
        Execution systems consume the specification. Governance by construction: if the runtime
        cannot present authority, evidence, or the right object state, the check is denied.
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {info && <Banner kind="ok">{info}</Banner>}
      {last && (
        <Banner kind={last.result === "allowed" ? "ok" : "error"}>
          {last.check_type}: {last.result}{last.reason ? ` — ${last.reason}` : ""}
        </Banner>
      )}

      <section className="card">
        <h3>Shared secret</h3>
        <p className="muted">Sent as X-Spec-Key. Default matches .env.example.</p>
        <div className="toolbar">
          <input value={key} onChange={(e) => setKey(e.target.value)} style={{ minWidth: 280 }} />
          <button onClick={() => void refreshChecks()}>List checks</button>
        </div>
      </section>

      <section className="card">
        <h3>Enforcement check</h3>
        <Form
          onSubmit={async (event) => {
            const data = new FormData(event.currentTarget);
            setError(null);
            setInfo(null);
            try {
              const row = await withKey((specKey) =>
                api.post<SpecCheck>(
                  "/spec/check",
                  {
                    work_unit_code: data.get("work_unit_code"),
                    check_type: data.get("check_type"),
                    caller: data.get("caller") || "ui",
                    approver: data.get("approver"),
                    actor: data.get("actor"),
                    evidence_ref: data.get("evidence_ref"),
                    object_state: data.get("object_state"),
                  },
                  specKey,
                ),
              );
              setLast(row);
              setInfo(row.result === "allowed" ? "Allowed" : "Denied");
              await refreshChecks();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label="Work Unit code">
            <select name="work_unit_code" required>
              <option value="">Select</option>
              {(units.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.code}>{u.code} · {u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Check type">
            <select name="check_type">{CHECK_TYPES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Approver / authority token"><input name="approver" placeholder="Order Desk" /></Field>
          <Field label="Actor"><input name="actor" /></Field>
          <Field label="Evidence ref"><input name="evidence_ref" /></Field>
          <Field label="Object state"><input name="object_state" placeholder="draft" /></Field>
          <Field label="Caller"><input name="caller" defaultValue="ui" /></Field>
          <button className="primary" type="submit">Check</button>
        </Form>
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
