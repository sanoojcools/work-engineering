import { useState } from "react";
import { api, errorMessage } from "../api";
import { useApi } from "../hooks";
import type { Candidate, Gap, Intent, Page, Trace } from "../types";
import { GAP_KINDS, INTENT_KINDS, ORIGINS, TRACE_KINDS } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

type Tab = "traces" | "intent" | "candidates" | "gaps";

export default function Discovery() {
  const [tab, setTab] = useState<Tab>("gaps");
  const traces = useApi<Page<Trace>>("/discovery/traces");
  const intent = useApi<Page<Intent>>("/discovery/intent");
  const candidates = useApi<Page<Candidate>>("/discovery/candidates");
  const gaps = useApi<Page<Gap>>("/discovery/gaps");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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

  return (
    <>
      <h2>Discovery</h2>
      <p className="lede">
        Work is found upward from traces and downward from intent. The conformance gap — declared vs
        discovered — is the first thing a census produces that anyone will pay for.
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {info && <Banner kind="ok">{info}</Banner>}
      <div className="tabs">
        {(["traces", "intent", "candidates", "gaps"] as Tab[]).map((id) => (
          <button key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
            {id}
          </button>
        ))}
      </div>

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
          {candidates.loading ? <Loading /> : (
            <DataTable
              rows={candidates.data?.items ?? []}
              columns={[
                { key: "name", header: "Name" },
                { key: "origin", header: "Origin" },
                { key: "status", header: "Status" },
                { key: "sampling_bias_note", header: "Bias note" },
              ]}
            />
          )}
          <Form
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = new FormData(form);
              return run(
                () =>
                  api.post("/discovery/candidates", {
                    name: data.get("name"),
                    origin: data.get("origin"),
                    sampling_bias_note: data.get("sampling_bias_note"),
                    payload: "{}",
                  }),
                () => {
                  form.reset();
                  candidates.reload();
                },
                "Candidate added",
              );
            }}
          >
            <Field label="Name"><input name="name" required /></Field>
            <Field label="Origin">
              <select name="origin">{ORIGINS.map((o) => <option key={o}>{o}</option>)}</select>
            </Field>
            <Field label="Sampling bias note" span2><input name="sampling_bias_note" /></Field>
            <button className="primary" type="submit">Add candidate</button>
          </Form>
        </section>
      )}

      {tab === "gaps" && (
        <section className="card">
          <div className="toolbar">
            <button
              className="primary"
              onClick={() =>
                void run(
                  () => api.post("/discovery/gaps/scan"),
                  () => gaps.reload(),
                  "Scan complete",
                )
              }
            >
              Scan declared vs discovered
            </button>
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
