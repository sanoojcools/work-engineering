import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { InfoTooltip } from "../components/InfoTooltip";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
import { V10 } from "../lib/v10Terms";
import { Banner, Empty, Loading } from "../ui";

type VersionRow = {
  version_id: number;
  sequence: number;
  gqs: number | null;
  ratified: boolean;
  work_unit_count: number;
  gates_passed: string[];
  accepted: boolean;
  created_at: string | null;
};

const GATE_THRESHOLD = 90;

/** Index for the delivery side. Until GET /api/genome/versions existed there
 * was no way to find a genome you had already imported — every genome route
 * needs a version_id the caller had to have kept from an import response. */
export default function GenomeVersions() {
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = V10.workRecord;
  const save = V10.saveDraft;
  const prev = V10.draftPreview;

  async function load() {
    setError(null);
    try {
      const data = await apiFetch.get<{ items: VersionRow[] }>("/genome/versions");
      setRows(data.items);
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Failed to load genome versions");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (needsKey) {
    return (
      <div>
        <h2>
          {rec.label} <InfoTooltip term={rec.term} simple={rec.simple} technical={rec.technical} />
        </h2>
        <ApiKeyBanner onSaved={load} />
      </div>
    );
  }

  return (
    <div>
      <h2>
        {rec.label} <InfoTooltip term={rec.term} simple={rec.simple} technical={rec.technical} />
      </h2>
      <p className="lede">
        Every import of the 18-attribute piece of work, scored before anything is written.{" "}
        <InfoTooltip term={V10.filesNotEnough.term} simple={V10.filesNotEnough.simple} technical={V10.filesNotEnough.technical} />
        A version below the gate is kept and shown, not discarded — the score is the record of why it
        was blocked.
      </p>

      {error && <Banner kind="error">{error}</Banner>}
      {!rows && !error && <Loading label="Loading work record drafts…" />}

      {rows && rows.length === 0 && (
        <Empty
          title="No work record drafts yet"
          hint={
            <>
              {save.label} from a sitting ({prev.label}), or import via <code>POST /api/genome/import</code>.
            </>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>GQS</th>
                <th>Pieces</th>
                <th>Gate</th>
                <th>Ratified</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const passed = row.gqs !== null && row.gqs >= GATE_THRESHOLD && row.accepted;
                return (
                  <tr key={row.version_id}>
                    <td><strong>v{row.sequence}</strong></td>
                    <td>{row.gqs !== null ? row.gqs.toFixed(2) : "—"}</td>
                    <td>{row.work_unit_count}</td>
                    <td>
                      {passed ? (
                        <span className="badge ok">passed</span>
                      ) : (
                        <span className="badge" title={`GQS gate threshold is ${GATE_THRESHOLD}`}>
                          blocked
                        </span>
                      )}
                    </td>
                    <td>{row.ratified ? <span className="badge ok">ratified</span> : <span className="muted">—</span>}</td>
                    <td className="muted">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </td>
                    <td><Link to={`/genome/${row.version_id}`}>Open →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
