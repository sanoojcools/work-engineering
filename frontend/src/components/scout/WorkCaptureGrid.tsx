import { useState } from "react";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";
import { HR_SAMPLE_ROWS } from "../../lib/scoutSamples";
import type { ScoutCapturedUnit, ScoutSession } from "../../types";

type DraftUnit = Omit<ScoutCapturedUnit, "id" | "created_at" | "updated_at">;

const EMPTY_DRAFT: DraftUnit = {
  name: "", inputs: "", outputs: "", systems: "", frequency: "",
  time_minutes: null, pain: "", handoffs: "", decision_rule: "",
};

const COLUMNS: { key: keyof DraftUnit; label: string; placeholder: string }[] = [
  { key: "name", label: "Work Unit", placeholder: "Client Onboarding" },
  { key: "inputs", label: "Inputs", placeholder: "Client docs" },
  { key: "outputs", label: "Outputs", placeholder: "Onboarded client" },
  { key: "systems", label: "Systems", placeholder: "Excel, Email" },
  { key: "frequency", label: "Frequency", placeholder: "12x/week" },
  { key: "pain", label: "Pain", placeholder: "Manual copy" },
  { key: "handoffs", label: "Handoffs", placeholder: "HR -> Ops" },
  // Was only ever editable through the "+ Add row" form below, never
  // visible or click-to-edit on an already-captured row -- yet it is one of
  // the seven scored dimensions (Genome Strength's "Decisions / Rules"), so
  // a unit could sit at 87% forever with no way to see which field that
  // last few percent needed. Now a real column like every other field.
  { key: "decision_rule", label: "Decision / rule", placeholder: "flag if mismatch > 1 day" },
];

/** Used only when "Fill remaining blanks" (below) meets a hand-typed unit
 * that doesn't match any HR_SAMPLE_ROWS name -- it must never invent a
 * specific business fact that could pass as something the interviewee
 * actually said. Every value here says plainly that it's a placeholder. */
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

  const capturedNames = new Set(session.units.map((u) => u.name.trim().toLowerCase()));
  const remainingSamples = HR_SAMPLE_ROWS.filter((r) => !capturedNames.has(r.name.toLowerCase())).length;

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

  /** Load sample rows. Typing eight rows by hand mid-demo is dead air, and a
   * half-filled grid can't reach the 100% that unlocks Future Preview. Rows
   * land through the same POST as a hand-typed one, so the completeness meter
   * recomputes exactly as it would otherwise — nothing here is faked. */
  async function loadSamples(count: number) {
    const existing = new Set(session.units.map((u) => u.name.trim().toLowerCase()));
    const pending = HR_SAMPLE_ROWS.filter((r) => !existing.has(r.name.toLowerCase())).slice(0, count);
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

  /** "Reach 100%" in one click, for seeing what Future Preview and the other
   * elevations look like once a session is complete, without hand-typing
   * every cell. Two honest passes, in order:
   *   1. Backfill blank cells on units already captured. A blank on a unit
   *      whose name matches a sample row gets that row's own real value
   *      (finishing a sample row someone only half-loaded); a blank on a
   *      genuinely hand-typed unit gets a plainly-labeled placeholder
   *      (GENERIC_FILL) — never a specific invented business fact.
   *   2. Add whichever of the 8 sample rows aren't captured yet, same as
   *      "Load all sample rows", until the unit count itself reaches 8.
   * Existing, already-filled cells are never touched. */
  async function fillToHundred() {
    setBusy(true);
    try {
      let latest = session;
      const sampleByName = new Map(HR_SAMPLE_ROWS.map((r) => [r.name.toLowerCase(), r]));

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
          patch.time_minutes = sample ? sample.time_minutes : GENERIC_FILL_MINUTES;
        }
        if (Object.keys(patch).length === 0) continue;
        latest = await apiFetch.patch<ScoutSession>(`/scout/sessions/${session.id}/units/${unit.id}`, patch);
        onChange(latest);
      }

      const existingNames = new Set(latest.units.map((u) => u.name.trim().toLowerCase()));
      for (const row of HR_SAMPLE_ROWS) {
        if (latest.units.length >= HR_SAMPLE_ROWS.length) break;
        if (existingNames.has(row.name.toLowerCase())) continue;
        latest = await apiFetch.post<ScoutSession>(`/scout/sessions/${session.id}/units`, row);
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
        <h3 style={{ marginBottom: 12 }}>Work Capture Grid</h3>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <button type="button" disabled={busy || remainingSamples === 0} onClick={() => void loadSamples(1)}>
            Add sample row
          </button>
          <button type="button" disabled={busy || remainingSamples === 0} onClick={() => void loadSamples(HR_SAMPLE_ROWS.length)}>
            {busy ? "Loading…" : `Load all ${HR_SAMPLE_ROWS.length} sample rows`}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || session.completeness_pct >= 100}
            onClick={() => void fillToHundred()}
            title="Fills every blank cell on the grid — matching sample data where a row already came from a sample, a plain 'not yet described' placeholder on anything hand-typed — so you can see what Future Preview and the other elevations look like once a session is complete."
          >
            {busy ? "Filling…" : "Fill to 100% (see full preview)"}
          </button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
        Samples are HR &amp; People Ops — the same function as the Client A census. They are saved exactly like
        typed rows, so the strength meter reflects them honestly. "Fill to 100%" only ever fills a cell that is
        currently blank — a hand-typed row keeps its own words, and any blank it's left with is filled with a
        plainly-labeled placeholder, never an invented answer.
      </p>
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
                  No work units captured yet — add the first one below.
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
