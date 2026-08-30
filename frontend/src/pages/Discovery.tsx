import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api";
import { CompanyBanner } from "../components/CompanyBanner";
import { LabelWithInfo } from "../components/InfoTooltip";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { DEMO_HR_SOP } from "../lib/demoSop";
import { parseWorkUnitFile } from "../lib/excelUpload";
import { FUNCTION_ORDER, getFunction } from "../lib/groupWorkUnits";
import { withClient } from "../lib/withClient";
import type { Candidate, Gap, Intent, Page, Trace, WorkUnit } from "../types";
import { GAP_KINDS, INTENT_KINDS, TRACE_KINDS } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

type Tab = "intake" | "traces" | "intent" | "candidates" | "gaps";

export default function Discovery() {
  const { client } = useCompany();
  const [tab, setTab] = useState<Tab>("intake");
  const traces = useApi<Page<Trace>>("/discovery/traces");
  const intent = useApi<Page<Intent>>(withClient("/discovery/intent", client?.id));
  const candidates = useApi<Page<Candidate>>(withClient("/discovery/candidates", client?.id));
  const gaps = useApi<Page<Gap>>(withClient("/discovery/gaps", client?.id));
  const units = useApi<Page<WorkUnit>>(withClient("/work-units/", client?.id));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [intakeText, setIntakeText] = useState(DEMO_HR_SOP);
  const [acceptedId, setAcceptedId] = useState<number | null>(null);
  const nav = useNavigate();

  const groupedUnits = useMemo(() => {
    const map = new Map<string, WorkUnit[]>();
    for (const name of FUNCTION_ORDER) map.set(name, []);
    for (const u of units.data?.items ?? []) {
      const fn = getFunction(u.code);
      if (!map.has(fn)) map.set(fn, []);
      map.get(fn)!.push(u);
    }
    return [...map.entries()].filter(([, list]) => list.length > 0);
  }, [units.data]);

  async function run(fn: () => Promise<unknown>, reload: () => void, ok?: string) {
    setError(null);
    setInfo(null);
    try {
      await fn();
      reload();
      if (ok) setInfo(ok);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const gapCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of gaps.data?.items ?? []) counts[g.kind] = (counts[g.kind] ?? 0) + 1;
    return counts;
  }, [gaps.data]);

  return (
    <>
      <h2 data-tour="discovery">Discovery</h2>
      <p className="lede">
        Work is found upward from traces and downward from intent (D1). The conformance gap —
        declared vs discovered — is the first thing a census produces that anyone will pay for (D3).
      </p>
      <CompanyBanner />
      {error && <Banner kind="error">{error}</Banner>}
      {info && <Banner kind="ok">{info}</Banner>}
      <div className="tabs">
        {(["intake", "traces", "intent", "candidates", "gaps"] as Tab[]).map((id) => (
          <button key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
            {id}
          </button>
        ))}
      </div>

      {tab === "intake" && (
        <section className="card">
          <h3>
            <LabelWithInfo label="Work Unit">Document intake</LabelWithInfo>
          </h3>
          <p className="hint">Paste a job description, SOP, or time-motion list. Upload .txt or .xlsx. Declared intent under-samples tacit work.</p>
          <textarea
            rows={8}
            style={{ width: "100%" }}
            value={intakeText}
            onChange={(e) => setIntakeText(e.target.value)}
            placeholder={"1. Collect joining documents\n2. Send welcome mail\n3. Create HRIS record"}
          />
          <div className="toolbar">
            <label className="primary" style={{ display: "inline-block" }}>
              Upload file
              <input
                className="file-hidden"
                type="file"
                accept=".txt,.xlsx,.csv"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const name = file.name.toLowerCase();
                  if (name.endsWith(".xlsx") || name.endsWith(".csv")) {
                    const rows = await parseWorkUnitFile(file);
                    setIntakeText(
                      rows
                        .map((r) => [r.code || r.title, r.business_object, r.current_condition, r.desired_condition].join(", "))
                        .join("\n") || await file.text(),
                    );
                  } else {
                    setIntakeText(await file.text());
                  }
                }}
              />
            </label>
            <button
              className="primary"
              type="button"
              disabled={!intakeText.trim()}
              onClick={() =>
                void run(
                  async () => {
                    const result = await api.post<{ items: Candidate[] }>("/discovery/suggest", {
                      text: intakeText,
                      origin: "downward",
                      title: intakeText.split("\n")[0]?.slice(0, 80) || "Intake",
                      kind: "sop",
                      persist: true,
                      client_id: client?.id,
                    });
                    setInfo(`${result.items.length} candidates proposed`);
                    setTab("candidates");
                    candidates.reload();
                    intent.reload();
                  },
                  () => undefined,
                )
              }
            >
              Extract candidates
            </button>
          </div>
        </section>
      )}

      {tab === "traces" && (
        <section className="card">
          {traces.loading ? <Loading /> : (
            <DataTable
              rows={traces.data?.items ?? []}
              columns={[
                { key: "kind", header: "Kind" },
                { key: "source_system", header: "System" },
                { key: "object_ref", header: "Object" },
                { key: "provenance", header: "Provenance" },
              ]}
            />
          )}
          <Form
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = new FormData(form);
              return run(
                () =>
                  api.post("/discovery/traces", {
                    kind: data.get("kind"),
                    source_system: data.get("source_system"),
                    object_ref: data.get("object_ref"),
                    payload: data.get("payload") || "{}",
                  }),
                () => {
                  form.reset();
                  traces.reload();
                },
                "Trace imported",
              );
            }}
          >
            <Field label="Kind">
              <select name="kind">{TRACE_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            </Field>
            <Field label="Source system"><input name="source_system" placeholder="ERP" /></Field>
            <Field label="Object ref"><input name="object_ref" /></Field>
            <Field label="Payload JSON"><input name="payload" placeholder="{}" /></Field>
            <button className="primary" type="submit">Import trace</button>
          </Form>
        </section>
      )}

      {tab === "intent" && (
        <section className="card">
          {intent.loading ? <Loading /> : (
            <DataTable
              rows={intent.data?.items ?? []}
              columns={[
                { key: "kind", header: "Kind" },
                { key: "title", header: "Title" },
                { key: "body", header: "Body" },
              ]}
            />
          )}
          <Form
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = new FormData(form);
              return run(
                () =>
                  api.post("/discovery/intent", {
                    kind: data.get("kind"),
                    title: data.get("title"),
                    body: data.get("body"),
                  }),
                () => {
                  form.reset();
                  intent.reload();
                },
                "Intent recorded",
              );
            }}
          >
            <Field label="Kind">
              <select name="kind">{INTENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            </Field>
            <Field label="Title"><input name="title" required /></Field>
            <Field label="Body" span2><textarea name="body" rows={3} /></Field>
            <button className="primary" type="submit">Add declared intent</button>
          </Form>
        </section>
      )}

      {tab === "candidates" && (
        <section className="card">
          {acceptedId && (
            <Banner kind="ok">
              Candidate accepted.{" "}
              <button type="button" className="primary" onClick={() => nav("/work-units")}>
                Open Work Unit
              </button>
            </Banner>
          )}
          {candidates.loading ? <Loading /> : (
            (candidates.data?.items ?? []).map((c) => {
              let payload: { current_condition?: string; desired_condition?: string; business_object?: string } = {};
              try {
                payload = JSON.parse(c.payload || "{}") as typeof payload;
              } catch {
                payload = {};
              }
              return (
                <div key={c.id} className="card">
                  <h3>{c.name}</h3>
                  <p className="muted">
                    {c.origin} · {c.status} · {c.provenance}
                    {payload.business_object ? ` · ${payload.business_object}` : ""}
                  </p>
                  <p className="hint">
                    {payload.current_condition || "—"} → {payload.desired_condition || "—"}
                  </p>
                  {c.sampling_bias_note && <p className="hint">{c.sampling_bias_note}</p>}
                  {c.status === "new" && (
                    <div className="toolbar">
                      <button
                        className="primary"
                        type="button"
                        onClick={() =>
                          void run(
                            async () => {
                              const wu = await api.post<WorkUnit>(`/discovery/candidates/${c.id}/accept`);
                              setAcceptedId(wu.id);
                            },
                            () => {
                              candidates.reload();
                              units.reload();
                            },
                            "Accepted as draft Work Unit",
                          )
                        }
                      >
                        Accept
                      </button>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const id = Number(e.target.value);
                          if (!id) return;
                          void run(
                            () => api.post(`/discovery/candidates/${c.id}/merge`, { work_unit_id: id }),
                            () => candidates.reload(),
                            "Merged into existing unit",
                          );
                        }}
                      >
                        <option value="">Merge into existing…</option>
                        {groupedUnits.map(([fn, list]) => (
                          <optgroup key={fn} label={fn}>
                            {list.map((u) => (
                              <option key={u.id} value={u.id}>{u.code} · {u.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          void run(
                            () => api.post(`/discovery/candidates/${c.id}/reject`),
                            () => candidates.reload(),
                            "Rejected",
                          )
                        }
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {tab === "gaps" && (
        <section className="card">
          <div className="toolbar">
            <button
              className="primary"
              onClick={() =>
                void run(
                  () => api.post(withClient("/discovery/gaps/scan", client?.id) || "/discovery/gaps/scan"),
                  () => gaps.reload(),
                  "Scan complete",
                )
              }
            >
              Scan declared vs discovered
            </button>
          </div>
          <div className="gap-counts">
            {GAP_KINDS.map((k) => (
              <span key={k} className="badge">{k}: {gapCounts[k] ?? 0}</span>
            ))}
          </div>
          {gaps.loading ? <Loading /> : (
            <DataTable
              rows={gaps.data?.items ?? []}
              columns={[
                { key: "kind", header: "Kind" },
                { key: "description", header: "Description" },
                { key: "declared_ref", header: "Declared" },
                { key: "discovered_ref", header: "Discovered" },
              ]}
            />
          )}
          <Form
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = new FormData(form);
              return run(
                () =>
                  api.post("/discovery/gaps", {
                    kind: data.get("kind"),
                    description: data.get("description"),
                    declared_ref: data.get("declared_ref"),
                    discovered_ref: data.get("discovered_ref"),
                  }),
                () => {
                  form.reset();
                  gaps.reload();
                },
              );
            }}
          >
            <Field label="Kind">
              <select name="kind">{GAP_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            </Field>
            <Field label="Description"><input name="description" /></Field>
            <Field label="Declared ref"><input name="declared_ref" /></Field>
            <Field label="Discovered ref"><input name="discovered_ref" /></Field>
            <button className="primary" type="submit">Record gap</button>
          </Form>
        </section>
      )}
    </>
  );
}
