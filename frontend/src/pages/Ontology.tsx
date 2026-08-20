import { useState } from "react";
import { api, errorMessage } from "../api";
import { useApi } from "../hooks";
import type { Entity, EntityEdge, EntityType, Page, Regulatory } from "../types";
import { KINDS, PROVENANCE, RELATION_KINDS } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

export default function Ontology() {
  const types = useApi<Page<EntityType>>("/ontology/types");
  const entities = useApi<Page<Entity>>("/ontology/entities");
  const edges = useApi<Page<EntityEdge>>("/ontology/edges");
  const register = useApi<Page<Regulatory>>("/regulatory/");
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, reload: () => void) {
    setError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <h2>Ontology</h2>
      <p className="lede">
        Layer 0: what kinds of things exist, their instances and current state, and how they connect
        in the Enterprise Graph. The Work Graph is a different graph — it hangs on Work Units.
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {types.error && <Banner kind="error">{types.error}</Banner>}

      <section className="card">
        <h3>Entity types</h3>
        {types.loading ? <Loading /> : (
          <DataTable
            rows={types.data?.items ?? []}
            columns={[
              { key: "name", header: "Name" },
              { key: "kind", header: "Kind" },
              { key: "state_machine", header: "State machine" },
            ]}
          />
        )}
        <Form
          onSubmit={(event) => {
            const form = event.currentTarget;
            const data = new FormData(form);
            return run(
              () =>
                api.post("/ontology/types", {
                  name: data.get("name"),
                  kind: data.get("kind"),
                  description: data.get("description") || "",
                  state_machine: data.get("state_machine") || "[]",
                }),
              () => {
                form.reset();
                types.reload();
              },
            );
          }}
        >
          <Field label="Name"><input name="name" required /></Field>
          <Field label="Kind">
            <select name="kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </Field>
          <Field label="Description"><input name="description" /></Field>
          <Field label="State machine JSON"><input name="state_machine" placeholder='["draft","validated"]' /></Field>
          <button className="primary" type="submit">Add type</button>
        </Form>
      </section>

      <section className="card">
        <h3>Enterprise Graph nodes</h3>
        {entities.loading ? <Loading /> : (
          <DataTable
            rows={entities.data?.items ?? []}
            columns={[
              { key: "id", header: "Id" },
              { key: "external_ref", header: "Ref" },
              { key: "current_state", header: "State" },
              { key: "type_id", header: "Type id" },
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
                api.post("/ontology/entities", {
                  type_id: Number(data.get("type_id")),
                  external_ref: data.get("external_ref"),
                  current_state: data.get("current_state"),
                  provenance: data.get("provenance"),
                }),
              () => {
                form.reset();
                entities.reload();
              },
            );
          }}
        >
          <Field label="Type">
            <select name="type_id" required>
              <option value="">Select type</option>
              {(types.data?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="External ref"><input name="external_ref" placeholder="Order#12345" /></Field>
          <Field label="Current state"><input name="current_state" /></Field>
          <Field label="Provenance">
            <select name="provenance">{PROVENANCE.map((p) => <option key={p}>{p}</option>)}</select>
          </Field>
          <button className="primary" type="submit">Add node</button>
        </Form>
      </section>

      <section className="card">
        <h3>Enterprise Graph edges</h3>
        {edges.loading ? <Loading /> : (
          <DataTable
            rows={edges.data?.items ?? []}
            columns={[
              { key: "id", header: "Id" },
              { key: "source_id", header: "From" },
              { key: "target_id", header: "To" },
              { key: "relation_type", header: "Relation" },
              { key: "kind", header: "Kind" },
            ]}
          />
        )}
        <Form
          onSubmit={(event) => {
            const form = event.currentTarget;
            const data = new FormData(form);
            return run(
              () =>
                api.post("/ontology/edges", {
                  source_id: Number(data.get("source_id")),
                  target_id: Number(data.get("target_id")),
                  relation_type: data.get("relation_type") || "related_to",
                  kind: data.get("kind"),
                }),
              () => {
                form.reset();
                edges.reload();
              },
            );
          }}
        >
          <Field label="Source id"><input name="source_id" type="number" required /></Field>
          <Field label="Target id"><input name="target_id" type="number" required /></Field>
          <Field label="Relation type"><input name="relation_type" placeholder="owns" /></Field>
          <Field label="Kind">
            <select name="kind">{RELATION_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </Field>
          <button className="primary" type="submit">Add edge</button>
        </Form>
      </section>

      <section className="card">
        <h3>Regulatory register</h3>
        <p className="muted">A compliance score without a register entry is an opinion (E6).</p>
        {register.loading ? <Loading /> : (
          <DataTable
            rows={register.data?.items ?? []}
            columns={[
              { key: "regulation", header: "Regulation" },
              { key: "clause", header: "Clause" },
              { key: "control_objective", header: "Control objective" },
              { key: "requires_licensed_human", header: "Licensed human", render: (r) => (r.requires_licensed_human ? "yes" : "no") },
            ]}
          />
        )}
        <Form
          onSubmit={(event) => {
            const form = event.currentTarget;
            const data = new FormData(form);
            return run(
              () =>
                api.post("/regulatory/", {
                  regulation: data.get("regulation"),
                  clause: data.get("clause"),
                  control_objective: data.get("control_objective"),
                  requires_licensed_human: data.get("licensed") === "on",
                }),
              () => {
                form.reset();
                register.reload();
              },
            );
          }}
        >
          <Field label="Regulation"><input name="regulation" required placeholder="SOX" /></Field>
          <Field label="Clause"><input name="clause" /></Field>
          <Field label="Control objective" span2><input name="control_objective" /></Field>
          <label className="span-2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input name="licensed" type="checkbox" /> Requires licensed human
          </label>
          <button className="primary" type="submit">Add entry</button>
        </Form>
      </section>
    </>
  );
}
