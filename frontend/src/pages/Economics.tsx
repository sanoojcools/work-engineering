import { useState } from "react";
import { api, errorMessage } from "../api";
import { CompanyBanner } from "../components/CompanyBanner";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import type { CostProfile, EconomicsProjection, Page, WorkUnit } from "../types";
import { LabelWithInfo } from "../components/InfoTooltip";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

export default function Economics() {
  const { client } = useCompany();
  const profiles = useApi<Page<CostProfile>>(withClient("/economics/", client?.id));
  const projection = useApi<EconomicsProjection>(withClient("/projections/economics", client?.id));
  const units = useApi<Page<WorkUnit>>(withClient("/work-units/", client?.id));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CostProfile | null>(null);

  const totals = projection.data?.totals;
  const unitById = new Map((units.data?.items ?? []).map((u) => [u.id, u]));

  return (
    <>
      <h2>
        <LabelWithInfo label="Economics">Economics</LabelWithInfo>
      </h2>
      <p className="lede">
        Four costing disciplines: include cost to verify, exceptions, ontology maintenance, then
        filter by attribution credibility. Cost per verified unit only where the count is credible.
        Example: 2 minutes × 50 hires/month = 100 minutes. Saving a profile here confirms it;
        census will not overwrite confirmed minutes.
      </p>
      <CompanyBanner />
      {error && <Banner kind="error">{error}</Banner>}
      {profiles.error && <Banner kind="error">{profiles.error}</Banner>}
      {totals && (
        <Banner kind="ok">
          Honest case: {totals.gross_hours.toFixed(1)} gross hours → {totals.attributed_hours.toFixed(1)} attributed
          hours → {totals.fte.toFixed(2)} FTE. This is the smaller number after cost to verify, exceptions, and
          attribution.
        </Banner>
      )}
      <div className="metrics">
        <div className="metric">
          <div className="n">{totals ? totals.gross_hours.toFixed(1) : "—"}</div>
          <div className="l">Gross hours</div>
        </div>
        <div className="metric">
          <div className="n">{totals ? totals.attributed_hours.toFixed(1) : "—"}</div>
          <div className="l">After attribution</div>
        </div>
        <div className="metric">
          <div className="n">{totals ? totals.fte.toFixed(3) : "—"}</div>
          <div className="l">FTE</div>
        </div>
        <div className="metric">
          <div className="n">{profiles.data?.total ?? 0}</div>
          <div className="l">Profiles</div>
        </div>
      </div>
      {profiles.loading ? <Loading /> : (
        <DataTable
          rows={profiles.data?.items ?? []}
          columns={[
            { key: "work_unit_id", header: "Unit", render: (r) => unitById.get(r.work_unit_id)?.code ?? r.work_unit_id },
            { key: "executions_per_month", header: "Exec / mo" },
            {
              key: "computed",
              header: "Gross h",
              render: (r) => {
                const gross = r.computed?.gross_hours;
                return typeof gross === "number" ? gross.toFixed(2) : "—";
              },
            },
            {
              key: "attribution_confidence",
              header: "Attributed h",
              render: (r) => {
                const value = r.computed?.attributed_hours;
                return typeof value === "number" ? value.toFixed(2) : "—";
              },
            },
            {
              key: "origin",
              header: "Origin",
            },
            {
              key: "id",
              header: "FTE",
              render: (r) => {
                const value = r.computed?.fte;
                return typeof value === "number" ? value.toFixed(3) : "—";
              },
            },
          ]}
        />
      )}
      <section className="card">
        <h3>Cost a Work Unit</h3>
        {saved?.computed && (
          <Banner kind="ok">
            Gross {String(saved.computed.gross_hours)} h · attributed {String(saved.computed.attributed_hours)} h · FTE{" "}
            {String(saved.computed.fte)}
          </Banner>
        )}
        <Form
          onSubmit={async (event) => {
            const data = new FormData(event.currentTarget);
            const id = Number(data.get("work_unit_id"));
            setError(null);
            try {
              const row = await api.put<CostProfile>(`/economics/${id}`, {
                executions_per_month: Number(data.get("executions_per_month")),
                minutes_per_execution: Number(data.get("minutes_per_execution")),
                verification_minutes: Number(data.get("verification_minutes")),
                failure_rate: Number(data.get("failure_rate")),
                exception_minutes: Number(data.get("exception_minutes")),
                maintenance_hours: Number(data.get("maintenance_hours")),
                attribution_confidence: Number(data.get("attribution_confidence")),
              });
              setSaved(row);
              profiles.reload();
              projection.reload();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label="Work Unit" span2>
            <select name="work_unit_id" required>
              <option value="">Select</option>
              {(units.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.code} · {u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Executions / month"><input name="executions_per_month" type="number" defaultValue={100} /></Field>
          <Field label={<LabelWithInfo label="Economics">Minutes to do</LabelWithInfo>}>
            <input name="minutes_per_execution" type="number" defaultValue={6} />
          </Field>
          <Field label="Minutes to verify"><input name="verification_minutes" type="number" defaultValue={3} /></Field>
          <Field label="Failure rate 0–1"><input name="failure_rate" type="number" step="0.01" defaultValue={0.05} /></Field>
          <Field label="Minutes per exception"><input name="exception_minutes" type="number" defaultValue={20} /></Field>
          <Field label="Maintenance hours / month"><input name="maintenance_hours" type="number" defaultValue={1} /></Field>
          <Field label="Attribution 0–1"><input name="attribution_confidence" type="number" step="0.05" defaultValue={0.8} /></Field>
          <button className="primary" type="submit">Compute</button>
        </Form>
      </section>
    </>
  );
}
