import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api";
import { CompanyBanner } from "../components/CompanyBanner";
import { EducationalNudge } from "../components/EducationalNudge";
import { LabelWithInfo } from "../components/InfoTooltip";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { withClient } from "../lib/withClient";
import { preferOnb04 } from "../lib/runs";
import type { Page, Verdict, WorkUnit } from "../types";
import { VERDICT_KEYS } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

const TERMS: Record<(typeof VERDICT_KEYS)[number], string> = {
  verifiability: "V - Verifiability",
  evidence: "E - Evidence",
  reversibility: "R - Reversibility",
  determinism: "D - Determinism",
  impact_scope: "I - Impact scope",
  compliance: "C - Compliance",
  tacitness: "T - Tacitness",
};

const DEFAULTS: Record<(typeof VERDICT_KEYS)[number], number> = {
  verifiability: 5,
  evidence: 5,
  reversibility: 5,
  determinism: 5,
  impact_scope: 4,
  compliance: 5,
  tacitness: 5,
};

export default function VerdictPage() {
  const { client } = useCompany();
  const scores = useApi<Page<Verdict>>(withClient("/verdict/", client?.id));
  const units = useApi<Page<WorkUnit>>(withClient("/work-units/", client?.id));
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Verdict | null>(null);
  const [unitId, setUnitId] = useState("");
  const [showHelp, setShowHelp] = useState(true);
  const [showNext, setShowNext] = useState(false);

  const items = units.data?.items ?? [];
  const unitById = new Map(items.map((u) => [u.id, u]));

  useEffect(() => {
    if (unitId || items.length === 0) return;
    const preferred = preferOnb04(items);
    if (preferred) setUnitId(String(preferred.id));
  }, [items, unitId]);

  return (
    <>
      <h2>
        <LabelWithInfo label="VERDICT">VERDICT</LabelWithInfo>
      </h2>
      <p className="lede">
        Seven supply properties, 1–5, converted deterministically into an autonomy level. Four hard
        gates cap the result regardless of the mean. Lower score = harder to trust to automation.
        Saving here <strong>confirms</strong> the score. Census re-run will not overwrite confirmed scores.
      </p>
      <CompanyBanner />
      {showHelp && (
        <EducationalNudge
          title="VERDICT = 7 questions that decide if a robot can do this"
          message="1 = hard for robot, 5 = easy. For Pre-Joining Communication (template mail), set high scores 5,5,5,5,4,5,5. Then click Save & Derive Autonomy."
          onDismiss={() => setShowHelp(false)}
          type="info"
        />
      )}
      {showNext && result && (
        <EducationalNudge
          title={`VERDICT now L${result.recommended_level} ${result.allocation}`}
          message="Scoring does not promote. To raise the authorised level you need 5 verification runs. Bulk create them next."
          nextLabel="Go to Verification"
          nextAction={() => nav("/verification")}
          onDismiss={() => setShowNext(false)}
          type="success"
        />
      )}
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
            { key: "mean", header: <LabelWithInfo label="MEAN">MEAN</LabelWithInfo>, render: (r) => r.mean ?? "—" },
            { key: "uncapped_level", header: <LabelWithInfo label="UNCAPPED L">UNCAPPED</LabelWithInfo> },
            { key: "recommended_level", header: <LabelWithInfo label="CAPPED L">CAPPED L</LabelWithInfo> },
            { key: "allocation", header: <LabelWithInfo label="Allocation">Allocation</LabelWithInfo> },
            { key: "origin", header: "Origin" },
            { key: "applied_gates", header: <LabelWithInfo label="Gates">Gates</LabelWithInfo> },
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
              setShowNext(true);
              scores.reload();
              units.reload();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label={<LabelWithInfo label="Work Unit">Work Unit</LabelWithInfo>} span2>
            <select name="work_unit_id" required value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Select</option>
              {items.map((u) => (
                <option key={u.id} value={u.id}>{u.code} · {u.name} (authorised L{u.autonomy_level})</option>
              ))}
            </select>
          </Field>
          <div className="verdict-grid span-2" data-tour="verdict-scores">
            {VERDICT_KEYS.map((key) => (
              <div className="verdict-cell" key={key}>
                <label>
                  <LabelWithInfo label={TERMS[key]}>{TERMS[key]}</LabelWithInfo>
                  <input name={key} type="number" min={1} max={5} defaultValue={DEFAULTS[key]} required />
                </label>
              </div>
            ))}
          </div>
          <button className="primary" type="submit">Save and confirm</button>
        </Form>
        <p className="muted">
          This saves the seven scores and calculates L-level. Scoring does not promote. If gates drop
          the cap below the authorised level, demotion is automatic.
        </p>
      </section>
    </>
  );
}
