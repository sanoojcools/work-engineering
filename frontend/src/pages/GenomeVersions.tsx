import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { apiFetch, NeedsApiKeyError } from "../lib/apiFetch";
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
        <h2>Genome</h2>
        <ApiKeyBanner onSaved={load} />
      </div>
    );
  }

  return (
    <div>
      <h2>Genome</h2>
      <p className="lede">
        Every import of the 18-attribute Work Unit contract, scored by GQS before anything is written.
        A version below the gate is kept and shown, not discarded — the score is the record of why it
        was blocked.
      </p>

      {error && <Banner kind="error">{error}</Banner>}
      {!rows && !error && <Loading label="Loading genome versions…" />}

      {rows && rows.length === 0 && (
        <Empty
          title="No genome versions yet"
          hint={
            <>
              Generate one from a Scout interview (Scout Interview → Future Preview → Generate V8 Work
              Units), or import a genome directly via <code>POST /api/genome/import</code>.
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
                <th>Work units</th>
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
                    <td><strong>v{row.version_id}</strong></td>
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
