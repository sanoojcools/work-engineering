import { useState } from "react";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";
import { OFFER_DESK_SAMPLE_ROWS } from "../../lib/offerDeskSamples";
import { V10 } from "../../lib/v10Terms";
import type { ScoutCapturedUnit, ScoutSession } from "../../types";
import { InfoTooltip } from "../InfoTooltip";

type DraftUnit = Omit<ScoutCapturedUnit, "id" | "created_at" | "updated_at">;

const EMPTY_DRAFT: DraftUnit = {
  name: "", inputs: "", outputs: "", systems: "", frequency: "",
  time_minutes: null, pain: "", handoffs: "", decision_rule: "",
};

const COLUMNS: { key: keyof DraftUnit; label: string; placeholder: string }[] = [
  { key: "name", label: "Piece of work", placeholder: "Client Onboarding" },
  { key: "inputs", label: "Inputs", placeholder: "Client docs" },
  { key: "outputs", label: "Outputs", placeholder: "Onboarded client" },
  { key: "systems", label: "Systems", placeholder: "Excel, Email" },
  { key: "frequency", label: "Frequency", placeholder: "12x/week" },
  { key: "pain", label: "Pain", placeholder: "Manual copy" },
  { key: "handoffs", label: "Handoffs", placeholder: "HR -> Ops" },
  { key: "decision_rule", label: "Decision / rule", placeholder: "flag if mismatch > 1 day" },
];

const GENERIC_FILL: Partial<Record<keyof DraftUnit, string>> = {
  inputs: "Not yet described",
  outputs: "Not yet described",
  systems: "Not yet named",
  frequency: "weekly",
  pain: "Not yet described",
  handoffs: "Not yet described",
  decision_rule: "Not yet described",
};
const GENERIC_FILL_MINUTES = 15;

export function WorkCaptureGrid({
  session,
  onChange,
  onNeedsKey,
}: {
  session: ScoutSession;
  onChange: (session: ScoutSession) => void;
  onNeedsKey: () => void;
}) {
  const [draft, setDraft] = useState<DraftUnit>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const SAMPLE_ROWS = session.type === "sme" ? OFFER_DESK_SAMPLE_ROWS : [];
  const capturedNames = new Set(session.units.map((u) => u.name.trim().toLowerCase()));
  const remainingSamples = SAMPLE_ROWS.filter((r) => !capturedNames.has(r.name.toLowerCase())).length;
  const grid = V10.grid;

  async function addRow() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const updated = await apiFetch.post<ScoutSession>(`/scout/sessions/${session.id}/units`, {
        ...draft,
        time_minutes: draft.time_minutes === null ? null : Number(draft.time_minutes),
      });
      onChange(updated);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
    }
  }

  async function loadSamples(count: number) {
    const existing = new Set(session.units.map((u) => u.name.trim().toLowerCase()));
    const pending = SAMPLE_ROWS.filter((r) => !existing.has(r.name.toLowerCase())).slice(0, count);
    if (pending.length === 0) return;
    setBusy(true);
    try {
      let latest = session;
      for (const row of pending) {
        latest = await apiFetch.post<ScoutSession>(`/scout/sessions/${session.id}/units`, row);
        onChange(latest);
      }
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
    }
  }

  /** Fill blank cells only. Does not add remaining sample rows — that is Skip ahead. */
  async function fillEmptyCells() {
    setBusy(true);
    try {
      let latest = session;
      const sampleByName = new Map(SAMPLE_ROWS.map((r) => [r.name.toLowerCase(), r]));

      for (const unit of latest.units) {
        const sample = sampleByName.get(unit.name.trim().toLowerCase());
        const patch: Partial<Record<keyof DraftUnit, string | number>> = {};
        for (const c of COLUMNS) {
          if (c.key === "name") continue;
          if (String(unit[c.key] ?? "").trim()) continue;
          const fill = sample ? (sample[c.key as keyof typeof sample] as string) : GENERIC_FILL[c.key];
          if (fill) patch[c.key] = fill;
        }
        if (unit.time_minutes === null) {
          if (sample) {
            if (sample.time_minutes != null) patch.time_minutes = sample.time_minutes;
          } else {
            patch.time_minutes = GENERIC_FILL_MINUTES;
          }
        }
        if (Object.keys(patch).length === 0) continue;
        latest = await apiFetch.patch<ScoutSession>(`/scout/sessions/${session.id}/units/${unit.id}`, patch);
        onChange(latest);
      }
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
    }
  }

  async function saveCell(unitId: number, field: string, value: string) {
    setBusy(true);
    try {
      const body = field === "time_minutes" ? { time_minutes: value === "" ? null : Number(value) } : { [field]: value };
      const updated = await apiFetch.patch<ScoutSession>(`/scout/sessions/${session.id}/units/${unitId}`, body);
      onChange(updated);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
      setEditingId(null);
      setEditingField(null);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ marginBottom: 12 }}>
          {grid.label} <InfoTooltip term={grid.term} simple={grid.simple} technical={grid.technical} />
        </h3>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button type="button" disabled={busy || remainingSamples === 0} onClick={() => void loadSamples(1)}>
            Add sample row
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || session.completeness_pct >= 100 || session.units.length === 0}
            onClick={() => void fillEmptyCells()}
          >
            {busy ? "Filling…" : "Fill empty cells only"}
          </button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
        {session.type === "sme"
          ? "Add sample row adds one Offer Desk step from Rashmi's sheet, then stops. Payroll and exit are not in this sitting."
          : "This seat has no sample dump. Type what was said, or use Turn these notes into rows."}
      </p>
      {session.type === "sme" && remainingSamples > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary className="hint" style={{ cursor: "pointer" }}>Skip ahead — load remaining Offer Desk steps</summary>
          <button type="button" disabled={busy} onClick={() => void loadSamples(SAMPLE_ROWS.length)} style={{ marginTop: 8 }}>
            {busy ? "Loading…" : `Load remaining ${remainingSamples} steps`}
          </button>
        </details>
      )}
      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>Time (min)</th>
            </tr>
          </thead>
          <tbody>
            {session.units.map((unit) => (
              <tr key={unit.id}>
                {COLUMNS.map((c) => {
                  const value = String(unit[c.key] ?? "");
                  const isEditing = editingId === unit.id && editingField === c.key;
                  const isMissing = !value.trim();
                  return (
                    <td
                      key={c.key}
                      onClick={() => {
                        setEditingId(unit.id);
                        setEditingField(c.key);
                      }}
                      style={{ cursor: "pointer", background: isMissing ? "#f7f1e4" : undefined, minWidth: 110 }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={value}
                          onBlur={(e) => saveCell(unit.id, c.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          style={{ width: "100%" }}
                        />
                      ) : (
                        value || <span className="muted">— click to fill</span>
                      )}
                    </td>
                  );
                })}
                <td
                  onClick={() => {
                    setEditingId(unit.id);
                    setEditingField("time_minutes");
                  }}
                  style={{ cursor: "pointer", background: unit.time_minutes === null ? "#f7f1e4" : undefined }}
                >
                  {editingId === unit.id && editingField === "time_minutes" ? (
                    <input
                      autoFocus
                      type="number"
                      defaultValue={unit.time_minutes ?? ""}
                      onBlur={(e) => saveCell(unit.id, "time_minutes", e.target.value)}
                      style={{ width: 70 }}
                    />
                  ) : (
                    unit.time_minutes ?? <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {session.units.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="muted">
                  No pieces captured yet — add the first one below, or Add sample row (Offer Desk sitting).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {COLUMNS.map((c) => (
          <label key={c.key}>
            <span>{c.label}</span>
            <input
              value={draft[c.key] as string}
              placeholder={c.placeholder}
              onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          <span>Time (min)</span>
          <input
            type="number"
            value={draft.time_minutes ?? ""}
            onChange={(e) => setDraft({ ...draft, time_minutes: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
        <button type="button" disabled={busy || !draft.name.trim()} onClick={addRow} style={{ alignSelf: "end" }}>
          + Add row
        </button>
      </div>
    </div>
  );
}
