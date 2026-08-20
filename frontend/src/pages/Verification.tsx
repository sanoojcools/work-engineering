import { useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { EducationalNudge } from "../components/EducationalNudge";
import { LabelWithInfo } from "../components/InfoTooltip";
import { useApi } from "../hooks";
import { bulkCreatePassingRuns, passedCountFor, preferOnb04 } from "../lib/runs";
import type { AutonomyChange, Page, VerificationRun, WorkUnit } from "../types";
import { METHODS, OUTCOMES } from "../types";
import { Banner, DataTable, Field, Form, Loading } from "../ui";

export default function Verification() {
  const runs = useApi<Page<VerificationRun>>("/verification/runs");
  const changes = useApi<Page<AutonomyChange>>("/verification/autonomy-changes");
  const units = useApi<Page<WorkUnit>>("/work-units/");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [unitId, setUnitId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showNeed, setShowNeed] = useState(true);

  const items = units.data?.items ?? [];
  const unitById = new Map(items.map((u) => [u.id, u]));
  const selectedId = Number(unitId) || preferOnb04(items)?.id;
  const selected = items.find((u) => u.id === selectedId) ?? null;
  const passed = selected ? passedCountFor(runs.data?.items ?? [], selected.id) : 0;

  useEffect(() => {
    if (unitId || items.length === 0) return;
    const preferred = preferOnb04(items);
    if (preferred) setUnitId(String(preferred.id));
  }, [items, unitId]);

  async function refresh() {
    runs.reload();
    changes.reload();
    units.reload();
  }

  async function bulk() {
    if (!selected) return;
    setError(null);
    setInfo(null);
    setBulkBusy(true);
    try {
      await bulkCreatePassingRuns(selected.id, 5);
      await refresh();
      setInfo("5 passing runs recorded.");
      setShowNeed(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <>
      <h2>
        <LabelWithInfo label="Verification Run">Verification</LabelWithInfo>
      </h2>
      <p className="lede">
        Seven methods. Independence is what makes a check worth its cost. Recording failures can
        demote autonomy automatically. Promotion still requires a human on the Work Unit page.
      </p>
      {showNeed && selected && passed < 5 && (
        <EducationalNudge
          title="Promotion needs 5 passing runs"
          message={`You have ${passed}/5 for ${selected.code}. Each run needs an evidence ref like MSG-123.`}
          nextLabel="Bulk create 5"
          nextAction={() => void bulk()}
          onDismiss={() => setShowNeed(false)}
          type="warning"
        />
      )}
      {error && <Banner kind="error">{error}</Banner>}
      {info && <Banner kind="ok">{info}</Banner>}
      {runs.error && <Banner kind="error">{runs.error}</Banner>}

      <section className="card" data-tour="verification">
        <h3>Runs for promotion</h3>
        <p>
          <span className="runs-chip">{passed}/5 runs</span>
          {selected ? <span className="muted">{selected.code} · authorised L{selected.autonomy_level}</span> : null}
        </p>
        <div className="toolbar">
          <button className="primary" type="button" disabled={!selected || bulkBusy || passed >= 5} onClick={() => void bulk()}>
            {bulkBusy ? "Creating…" : "Bulk create 5"}
          </button>
        </div>
        <p className="hint">Creates five independent passing runs with evidence refs MSG-101 through MSG-105.</p>
      </section>

      <section className="card">
        <h3>Record a run</h3>
        <Form
          onSubmit={async (event) => {
            const form = event.currentTarget;
            const data = new FormData(form);
            setError(null);
            setInfo(null);
            try {
              await api.post("/verification/runs", {
                work_unit_id: Number(data.get("work_unit_id")),
                method: data.get("method"),
                independent: data.get("independent") === "on",
                outcome: data.get("outcome"),
                evidence_ref: data.get("evidence_ref"),
                notes: data.get("notes"),
              });
              form.reset();
              await refresh();
              setInfo("Run recorded. Fail-rate breaches demote automatically.");
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Field label={<LabelWithInfo label="Work Unit">Work Unit</LabelWithInfo>}>
            <select name="work_unit_id" required value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Select</option>
              {items.map((u) => (
                <option key={u.id} value={u.id}>{u.code} · L{u.autonomy_level}</option>
              ))}
            </select>
          </Field>
          <Field label="Method">
            <select name="method">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <Field label="Outcome">
            <select name="outcome">{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select>
          </Field>
          <Field label={<LabelWithInfo label="Evidence / Evidence Ref">Evidence ref</LabelWithInfo>}>
            <input name="evidence_ref" placeholder="MSG-123" />
          </Field>
          <Field label="Notes" span2><input name="notes" /></Field>
          <label className="span-2" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input name="independent" type="checkbox" defaultChecked /> Independent checker
          </label>
          <button className="primary" type="submit">Record run</button>
        </Form>
      </section>

      <h3>Runs</h3>
      {runs.loading ? <Loading /> : (
        <DataTable
          rows={runs.data?.items ?? []}
          columns={[
            { key: "work_unit_id", header: "Unit", render: (r) => unitById.get(r.work_unit_id)?.code ?? r.work_unit_id },
            { key: "method", header: "Method" },
            { key: "outcome", header: "Outcome" },
            { key: "independent", header: "Independent", render: (r) => (r.independent ? "yes" : "no") },
            { key: "ran_at", header: "When" },
          ]}
        />
      )}

      <h3>Autonomy changes</h3>
      {changes.loading ? <Loading /> : (
        <DataTable
          rows={changes.data?.items ?? []}
          columns={[
            { key: "work_unit_id", header: "Unit", render: (r) => unitById.get(r.work_unit_id)?.code ?? r.work_unit_id },
            { key: "kind", header: "Kind" },
            { key: "from_level", header: "From", render: (r) => `L${r.from_level}` },
            { key: "to_level", header: "To", render: (r) => `L${r.to_level}` },
            { key: "approved_by", header: "Approver" },
            { key: "reason", header: "Reason" },
          ]}
        />
      )}
    </>
  );
}
