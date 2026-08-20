import { useState } from "react";
import { api, errorMessage } from "../api";
import { useApi } from "../hooks";
import type { Page, Verdict, WorkUnit } from "../types";
import { VERDICT_KEYS } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

const LABELS: Record<(typeof VERDICT_KEYS)[number], string> = {
  verifiability: "V Verifiability",
  evidence: "E Evidence",
  reversibility: "R Reversibility",
  determinism: "D Determinism",
  impact_scope: "I Impact scope",
  compliance: "C Compliance",
  tacitness: "T Tacitness",
};

export default function VerdictPage() {
  const scores = useApi<Page<Verdict>>("/verdict/");
  const units = useApi<Page<WorkUnit>>("/work-units/");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Verdict | null>(null);

  const unitById = new Map((units.data?.items ?? []).map((u) => [u.id, u]));

  return (
    <>
      <h2>VERDICT</h2>
      <p className="lede">
        Seven supply properties, 1–5, converted deterministically into an autonomy level. Four hard
        gates cap the result regardless of the mean. Lower score = harder to trust to automation.
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      {scores.error && <Banner kind="error">{scores.error}</Banner>}
      {result && (
        <Banner kind="ok">
          Recommended L{result.recommended_level} ({result.level_name}) · allocation {result.allocation} ·
          gates {result.applied_gates}
        </Banner>
      )}
      {scores.loading ? <Loading /> : (
        <DataTable
          rows={scores.data?.items ?? []}
          columns={[
            { key: "work_unit_id", header: "Unit", render: (r) => unitById.get(r.work_unit_id)?.code ?? r.work_unit_id },
            { key: "mean", header: "Mean", render: (r) => r.mean ?? "—" },
            { key: "uncapped_level", header: "Uncapped" },
            { key: "recommended_level", header: "Capped L" },
            { key: "allocation", header: "Allocation" },
            { key: "applied_gates", header: "Gates" },
          ]}
        />
      )}
      <section className="card">
        <h3>Score a Work Unit</h3>
        <Form
          onSubmit={async (event) => {
            const data = new FormData(event.currentTarget);
            const id = Number(data.get("work_unit_id"));
            const body: Record<string, number> = {};
            for (const key of VERDICT_KEYS) body[key] = Number(data.get(key));
            setError(null);
            try {
              const saved = await api.put<Verdict>(`/verdict/${id}`, body);
              setResult(saved);
              scores.reload();
              units.reload();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label="Work Unit" span2>
            <select name="work_unit_id" required>
              <option value="">Select</option>
              {(units.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.code} · {u.name} (authorised L{u.autonomy_level})</option>
              ))}
            </select>
          </Field>
          {VERDICT_KEYS.map((key) => (
            <Field key={key} label={`${LABELS[key]} (1–5)`}>
              <input name={key} type="number" min={1} max={5} defaultValue={3} required />
            </Field>
          ))}
          <button className="primary" type="submit">Derive autonomy</button>
        </Form>
        <p className="muted">
          Scoring does not promote. If gates drop the cap below the authorised level, demotion is
          automatic.
        </p>
      </section>
    </>
  );
}
