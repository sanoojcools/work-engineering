import { useState } from "react";
import { api, errorMessage } from "../api";
import { useApi } from "../hooks";
import type { EntityType, Page, WorkUnit } from "../types";
import { ACTOR_TYPES, METHODS, PROVENANCE } from "../types";
import { Badge, Banner, DataTable, Field, Form, Loading } from "../ui";

export default function WorkUnits() {
  const list = useApi<Page<WorkUnit>>("/work-units/");
  const types = useApi<Page<EntityType>>("/ontology/types");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selected = (list.data?.items ?? []).find((u) => u.id === selectedId) ?? null;

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (ok) setInfo(ok);
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <h2>Work Units</h2>
      <p className="lede">
        Independently accountable commitments. All 18 contract attributes must be present for
        machine-readability. Click a row for promotion, reconciliation, and missing fields.
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {info && <Banner kind="ok">{info}</Banner>}
      {list.error && <Banner kind="error">{list.error}</Banner>}
      <div className="toolbar">
        <button className="primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close form" : "New Work Unit"}
        </button>
        <span className="muted">{list.data?.total ?? 0} in inventory</span>
      </div>
      {showCreate && (
        <section className="card">
          <h3>New contract</h3>
          <Form
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = new FormData(form);
              return act(async () => {
                await api.post("/work-units/", {
                  code: data.get("code"),
                  name: data.get("name"),
                  business_object_type_id: Number(data.get("business_object_type_id")),
                  current_condition: data.get("current_condition"),
                  desired_condition: data.get("desired_condition"),
                  context: data.get("context"),
                  trigger: data.get("trigger"),
                  inputs: data.get("inputs"),
                  authority: data.get("authority"),
                  actor_constraints: data.get("actor_constraints"),
                  acceptance_criteria: data.get("acceptance_criteria"),
                  evidence_required: data.get("evidence_required"),
                  verification_method: data.get("verification_method"),
                  sla_hours: Number(data.get("sla_hours") || 0),
                  failure_semantics: data.get("failure_semantics"),
                  provenance: data.get("provenance"),
                  owner: data.get("owner"),
                  actor_type: data.get("actor_type"),
                });
                form.reset();
                setShowCreate(false);
              }, "Work Unit created");
            }}
          >
            <Field label="Code"><input name="code" required placeholder="WU-OTC-17" /></Field>
            <Field label="Name"><input name="name" required /></Field>
            <Field label="Business object">
              <select name="business_object_type_id" required>
                <option value="">Select</option>
                {(types.data?.items ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner"><input name="owner" /></Field>
            <Field label="Current condition"><input name="current_condition" required /></Field>
            <Field label="Desired condition"><input name="desired_condition" required /></Field>
            <Field label="Context" span2><input name="context" /></Field>
            <Field label="Trigger"><input name="trigger" /></Field>
            <Field label="Inputs"><input name="inputs" /></Field>
            <Field label="Authority"><input name="authority" /></Field>
            <Field label="Actor constraints"><input name="actor_constraints" /></Field>
            <Field label="Acceptance criteria" span2><input name="acceptance_criteria" /></Field>
            <Field label="Evidence required" span2><input name="evidence_required" /></Field>
            <Field label="Verification method">
              <select name="verification_method">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </Field>
            <Field label="SLA hours"><input name="sla_hours" type="number" defaultValue={8} /></Field>
            <Field label="Failure semantics" span2><input name="failure_semantics" /></Field>
            <Field label="Provenance">
              <select name="provenance">{PROVENANCE.map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="Actor type">
              <select name="actor_type">{ACTOR_TYPES.map((a) => <option key={a}>{a}</option>)}</select>
            </Field>
            <button className="primary" type="submit">Create</button>
          </Form>
        </section>
      )}
      <div className="split">
        <div>
          {list.loading ? <Loading /> : (
            <DataTable
              rows={list.data?.items ?? []}
              selectedId={selectedId}
              onRowClick={(row) => setSelectedId(row.id)}
              columns={[
                { key: "code", header: "Code" },
                { key: "name", header: "Name" },
                { key: "status", header: "Status" },
                { key: "autonomy_level", header: "L", render: (r) => `L${r.autonomy_level}` },
                {
                  key: "machine_readable",
                  header: "Readable",
                  render: (r) => <Badge ok={r.machine_readable}>{r.machine_readable ? "yes" : "no"}</Badge>,
                },
              ]}
            />
          )}
        </div>
        <aside className="card">
          {!selected && <p className="muted">Select a Work Unit to inspect the contract and act on the ladder.</p>}
          {selected && (
            <>
              <h3>{selected.code}</h3>
              <p>{selected.name}</p>
              <p className="muted">
                {selected.current_condition} → {selected.desired_condition} · owner {selected.owner || "—"} · actor{" "}
                {selected.actor_type}
              </p>
              <p>
                <Badge ok={selected.status === "authoritative"}>{selected.status}</Badge>
                <Badge ok={selected.machine_readable}>{selected.machine_readable ? "machine-readable" : "incomplete"}</Badge>
              </p>
              {selected.missing_attributes.length > 0 && (
                <p className="muted">Missing: {selected.missing_attributes.join(", ")}</p>
              )}
              <dl>
                <dt className="muted">Authority</dt>
                <dd>{selected.authority || "—"}</dd>
                <dt className="muted">Acceptance</dt>
                <dd>{selected.acceptance_criteria || "—"}</dd>
                <dt className="muted">Evidence</dt>
                <dd>{selected.evidence_required || "—"}</dd>
                <dt className="muted">Verification</dt>
                <dd>{selected.verification_method}</dd>
              </dl>
              <div className="toolbar">
                <button onClick={() => void act(() => api.post(`/work-units/${selected.id}/reconcile`), "Reconciled")}>
                  Reconcile
                </button>
                <button onClick={() => void act(() => api.post(`/work-units/${selected.id}/authoritative`), "Authoritative")}>
                  Make authoritative
                </button>
              </div>
              <Form
                onSubmit={(event) => {
                  const data = new FormData(event.currentTarget);
                  return act(
                    () =>
                      api.post(`/work-units/${selected.id}/promote`, {
                        to_level: Number(data.get("to_level")),
                        approved_by: data.get("approved_by"),
                        reason: data.get("reason"),
                      }),
                    "Promoted",
                  );
                }}
              >
                <Field label="Promote to">
                  <input name="to_level" type="number" min={2} max={6} defaultValue={selected.autonomy_level + 1} />
                </Field>
                <Field label="Approved by"><input name="approved_by" required /></Field>
                <Field label="Reason" span2><input name="reason" /></Field>
                <button className="primary" type="submit">Promote (human)</button>
              </Form>
              <Form
                onSubmit={(event) => {
                  const data = new FormData(event.currentTarget);
                  return act(
                    () =>
                      api.post(`/work-units/${selected.id}/demote`, {
                        to_level: Number(data.get("to_level")),
                        reason: data.get("reason"),
                      }),
                    "Demoted",
                  );
                }}
              >
                <Field label="Demote to">
                  <input name="to_level" type="number" min={1} max={5} defaultValue={Math.max(1, selected.autonomy_level - 1)} />
                </Field>
                <Field label="Reason"><input name="reason" /></Field>
                <button type="submit">Demote (automatic path)</button>
              </Form>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
