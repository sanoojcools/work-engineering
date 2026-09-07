import { useState } from "react";
import { ApiKeyBanner } from "../ApiKeyBanner";
import { NeedsApiKeyError } from "../../lib/apiFetch";
import { buildCensusMarkdown, censusExportFilename, downloadMarkdown, gatherCensusExportInput } from "../../lib/censusExport";
import { useIsGuest } from "../../lib/guestMode";
import { useCompany } from "../../company";

/** P1 (docs/BUILD_PROGRAM.md CENSUS-PACK): "Download census" -> one
 * markdown file, live state only (lib/censusExport.ts does the gathering
 * and assembly; this component is just the click -> fetch -> save wiring,
 * the same shape ModerationSection/IntentCard already use for a keyed
 * write). Used both compactly on the census shell (CensusStepper, every
 * step) and with fuller copy on Plan itself. */
export function DownloadCensusButton({ compact = false }: { compact?: boolean }) {
  const isGuest = useIsGuest();
  const { client, keyClientId } = useCompany();
  const [busy, setBusy] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const input = await gatherCensusExportInput(isGuest, keyClientId, client?.name ?? null);
      const markdown = buildCensusMarkdown(input);
      downloadMarkdown(censusExportFilename(), markdown);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? err.message : "Could not build the census export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className={compact ? undefined : "primary"}
        disabled={busy}
        onClick={() => void download()}
        style={compact ? { fontSize: 12, padding: "3px 10px" } : undefined}
      >
        {busy ? "Building…" : "Download census"}
      </button>
      {needsKey && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && <div className="banner error">{error}</div>}
    </div>
  );
}
