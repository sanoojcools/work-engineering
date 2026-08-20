import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, errorMessage, getSpecKey } from "../api";
import { EducationalNudge } from "../components/EducationalNudge";
import { LabelWithInfo } from "../components/InfoTooltip";
import { useApi } from "../hooks";
import { parseWorkUnitWorkbook, summarizeUpload, workUnitPayload } from "../lib/excelUpload";
import { bulkCreatePassingRuns, isPromotionFriction, passedCountFor } from "../lib/runs";
import type { EntityType, Page, VerificationRun, WorkUnit } from "../types";
import { ACTOR_TYPES, METHODS, PROVENANCE } from "../types";
import { Badge, Banner, DataTable, Field, Form, Loading } from "../ui";

const LEVELS = [1, 2, 3, 4, 5, 6];

export default function WorkUnits() {
  const list = useApi<Page<WorkUnit>>("/work-units/");
  const types = useApi<Page<EntityType>>("/ontology/types");
  const runs = useApi<Page<VerificationRun>>("/verification/runs");
  const nav = useNavigate();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [createdNudge, setCreatedNudge] = useState(false);
  const [friction, setFriction] = useState<{ title: string; message: string; toVerify?: boolean } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const items = list.data?.items ?? [];
  const selected = items.find((u) => u.id === selectedId) ?? null;
  const employeeType = (types.data?.items ?? []).find((t) => t.name.toLowerCase() === "employee");
  const passed = selected ? passedCountFor(runs.data?.items ?? [], selected.id) : 0;

  useEffect(() => {
    if (!highlightedId) return;
    const row = document.querySelector(`[data-row-id="${highlightedId}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId, items.length]);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setError(null);
    setInfo(null);
    setFriction(null);
    try {
      await fn();
      if (ok) setInfo(ok);
      list.reload();
      runs.reload();
    } catch (err) {
      const message = errorMessage(err);
      if (isPromotionFriction(message)) {
        setFriction({
          title: message.toLowerCase().includes("one level")
            ? "Promotion moves one level at a time"
            : "Needs 5 verification runs",
          message: message.toLowerCase().includes("one level")
            ? "For safety you can only go L1 to L2, then L2 to L3. Use the stepper."
            : `Promotion needs proof. You have ${passed}/5. Bulk create 5 passing runs.`,
          toVerify: !message.toLowerCase().includes("one level"),
        });
        return;
      }
      setError(message);
    }
  }

  async function ensureBusinessObject(name: string, cache: Map<string, number>): Promise<number> {
    const key = name.trim() || "Employee";
    const cached = cache.get(key.toLowerCase());
    if (cached) return cached;
    const known = (types.data?.items ?? []).find((t) => t.name.toLowerCase() === key.toLowerCase());
    if (known) {
      cache.set(key.toLowerCase(), known.id);
      return known.id;
    }
    try {
      const created = await api.post<EntityType>("/ontology/types", {
        name: key,
        kind: "business_object",
        description: `${key} (bulk upload)`,
        state_machine: '["draft","pre_joining","active","on_hold","offboarded","exited"]',
      });
      cache.set(key.toLowerCase(), created.id);
      return created.id;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        types.reload();
        const page = await api.get<Page<EntityType>>("/ontology/types");
        const match = page.items.find((t) => t.name.toLowerCase() === key.toLowerCase());
        if (match) {
          cache.set(key.toLowerCase(), match.id);
          return match.id;
        }
      }
      throw err;
    }
  }

  async function uploadExcel(file: File) {
    setError(null);
    setInfo(null);
    setFriction(null);
    setUploadBusy(true);
    try {
      const rows = parseWorkUnitWorkbook(await file.arrayBuffer());
      if (rows.length === 0) {
        setError("No Work Unit rows found in that workbook.");
        return;
      }
      const specKey = getSpecKey();
      const typeCache = new Map<string, number>();
      const known = new Set(items.map((u) => u.code));
      const existing: string[] = [];
      const failed: string[] = [];
      let created = 0;
      setUploadProgress({ current: 0, total: rows.length });
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        setUploadProgress({ current: i + 1, total: rows.length });
        if (known.has(row.code)) {
          existing.push(row.code);
          continue;
        }
        try {
          const typeId = await ensureBusinessObject(row.business_object, typeCache);
          await api.post<WorkUnit>("/work-units/", workUnitPayload(row, typeId), specKey);
          known.add(row.code);
          created += 1;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            existing.push(row.code);
            known.add(row.code);
          } else {
            failed.push(row.code);
          }
        }
      }
      setInfo(summarizeUpload(created, existing, failed));
      list.reload();
      types.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploadBusy(false);
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      <h2>
        <LabelWithInfo label="Work Unit">Work Units</LabelWithInfo>
      </h2>
      <p className="lede">
        Independently accountable commitments. All 18 contract attributes must be present for
        machine-readability. Click a row for promotion, reconciliation, and missing fields.
      </p>
      {createdNudge && (
        <EducationalNudge
          title="Work Unit created"
          message="Scroll to the highlighted row, click it, then Reconcile. Next: score VERDICT."
          nextLabel="Go to VERDICT"
          nextAction={() => nav("/verdict")}
          onDismiss={() => setCreatedNudge(false)}
          type="success"
        />
      )}
      {friction && (
        <EducationalNudge
          title={friction.title}
          message={friction.message}
          nextLabel={friction.toVerify ? "Create 5 runs now" : undefined}
          nextAction={friction.toVerify ? () => nav("/verification") : undefined}
          onDismiss={() => setFriction(null)}
          type="warning"
        />
      )}
      {error && <Banner kind="error">{error}</Banner>}
      {info && <Banner kind="ok">{info}</Banner>}
      {list.error && <Banner kind="error">{list.error}</Banner>}
      <div className="toolbar">
        <button className="primary" data-tour="new-work-unit" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close form" : "New Work Unit"}
        </button>
        <button type="button" disabled={uploadBusy} onClick={() => fileInput.current?.click()}>
          Bulk Upload Excel
        </button>
        <LabelWithInfo label="Bulk Upload Excel" />
        <input
          ref={fileInput}
          className="file-hidden"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadExcel(file);
          }}
        />
        <span className="muted">{list.data?.total ?? 0} in inventory</span>
      </div>
      {uploadProgress && (
        <div className="upload-progress" aria-live="polite">
          <div className="upload-progress-label">
            Creating {uploadProgress.current} of {uploadProgress.total}
          </div>
          <div className="upload-bar">
            <span style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
          </div>
        </div>
      )}
      {showCreate && (
        <section className="card">
          <h3>New contract</h3>
          <p className="hint">
            Prefills WU-ONB-04 Pre-Joining Communication. Owner and authority are HR Ops SPOC, not Order Desk.
          </p>
          <Form
            key={employeeType?.id ?? "pending-types"}
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = new FormData(form);
              return act(async () => {
                const created = await api.post<WorkUnit>("/work-units/", {
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
                setSelectedId(created.id);
                setHighlightedId(created.id);
                setCreatedNudge(true);
              });
            }}
          >
            <Field label={<LabelWithInfo label="Work Unit">Code</LabelWithInfo>}>
              <input name="code" required defaultValue="WU-ONB-04" placeholder="WU-ONB-04" />
            </Field>
            <Field label="Name">
              <input name="name" required defaultValue="Pre-Joining Communication" />
            </Field>
            <Field label={<LabelWithInfo label="Business Object">Business object</LabelWithInfo>}>
              <select name="business_object_type_id" required defaultValue={employeeType?.id ?? ""}>
                <option value="">Select</option>
                {(types.data?.items ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label={<LabelWithInfo label="Authority / Owner">Owner</LabelWithInfo>}>
              <input name="owner" defaultValue="HR Ops SPOC" />
            </Field>
            <Field label={<LabelWithInfo label="Current Condition">Current condition</LabelWithInfo>}>
              <input name="current_condition" required defaultValue="Offer status = signed in Zoho" />
            </Field>
            <Field label={<LabelWithInfo label="Desired Condition">Desired condition</LabelWithInfo>}>
              <input name="desired_condition" required defaultValue="Welcome mail status = delivered" />
            </Field>
            <Field label="Context" span2>
              <input name="context" defaultValue="Pre-joining welcome for a signed offer" />
            </Field>
            <Field label="Trigger"><input name="trigger" defaultValue="Offer signed in Zoho" /></Field>
            <Field label="Inputs"><input name="inputs" defaultValue="Candidate name, joining date, offer id" /></Field>
            <Field label={<LabelWithInfo label="Authority / Owner">Authority</LabelWithInfo>}>
              <input name="authority" defaultValue="HR Ops SPOC" />
            </Field>
            <Field label="Actor constraints"><input name="actor_constraints" defaultValue="agent" /></Field>
            <Field label={<LabelWithInfo label="Acceptance Criteria">Acceptance criteria</LabelWithInfo>} span2>
              <input name="acceptance_criteria" defaultValue="Outlook mail log exists AND Teams invite exists" />
            </Field>
            <Field label={<LabelWithInfo label="Evidence / Evidence Ref">Evidence required</LabelWithInfo>} span2>
              <input name="evidence_required" defaultValue="Outlook message ID + Teams invite ID" />
            </Field>
            <Field label={<LabelWithInfo label="Verification Method">Verification method</LabelWithInfo>}>
              <select name="verification_method">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </Field>
            <Field label="SLA hours"><input name="sla_hours" type="number" defaultValue={8} /></Field>
            <Field label="Failure semantics" span2>
              <input name="failure_semantics" defaultValue="Retry send; escalate to HR Ops SPOC" />
            </Field>
            <Field label="Provenance">
              <select name="provenance" defaultValue="designed">{PROVENANCE.map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label={<LabelWithInfo label="Owner Type">Actor type</LabelWithInfo>}>
              <select name="actor_type" defaultValue="agent">{ACTOR_TYPES.map((a) => <option key={a}>{a}</option>)}</select>
            </Field>
            <button className="primary" type="submit">Create</button>
          </Form>
        </section>
      )}
      <div className="split">
        <div>
          {list.loading ? <Loading /> : (
            <DataTable
              rows={items}
              selectedId={selectedId}
              highlightedId={highlightedId}
              onRowClick={(row) => setSelectedId(row.id)}
              columns={[
                { key: "code", header: <LabelWithInfo label="Work Unit">Code</LabelWithInfo> },
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
                <button data-tour="reconcile" onClick={() => void act(() => api.post(`/work-units/${selected.id}/reconcile`), "Reconciled")}>
                  Reconcile
                </button>
                <button onClick={() => void act(() => api.post(`/work-units/${selected.id}/authoritative`), "Authoritative")}>
                  Make authoritative
                </button>
              </div>

              <h3>
                <LabelWithInfo label="Promotion">Promotion (one level at a time)</LabelWithInfo>
              </h3>
              <div className="stepper" data-tour="promote">
                {LEVELS.map((level, i) => (
                  <span key={level} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && <span className="step-line" />}
                    <span
                      className={
                        level < selected.autonomy_level
                          ? "step done"
                          : level === selected.autonomy_level
                            ? "step current"
                            : "step"
                      }
                    >
                      L{level}
                      {level === selected.autonomy_level + 1 ? " →" : ""}
                    </span>
                  </span>
                ))}
              </div>
              <p>
                <span className="runs-chip">
                  <LabelWithInfo label="Verification Run">{passed}/5 runs</LabelWithInfo>
                </span>
                {passed < 5 && (
                  <span className="muted">Need 5 passing runs to promote.</span>
                )}
              </p>
              <div className="toolbar">
                <button
                  className="primary"
                  type="button"
                  disabled={selected.autonomy_level >= 6}
                  onClick={() =>
                    void act(
                      () =>
                        api.post(`/work-units/${selected.id}/promote`, {
                          to_level: selected.autonomy_level + 1,
                          approved_by: selected.owner || selected.authority || "HR Ops SPOC",
                          reason: `Promote L${selected.autonomy_level} to L${selected.autonomy_level + 1}`,
                        }),
                      `Promoted to L${selected.autonomy_level + 1}`,
                    )
                  }
                >
                  Promote to L{Math.min(6, selected.autonomy_level + 1)}
                </button>
                <button
                  type="button"
                  disabled={bulkBusy || passed >= 5}
                  onClick={() =>
                    void act(async () => {
                      setBulkBusy(true);
                      try {
                        await bulkCreatePassingRuns(selected.id, 5);
                      } finally {
                        setBulkBusy(false);
                      }
                    }, "5 passing runs recorded")
                  }
                >
                  {bulkBusy ? "Creating…" : "Bulk create 5"}
                </button>
              </div>

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
