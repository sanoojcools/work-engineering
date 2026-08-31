import { useEffect, useState } from "react";
import { api, errorMessage, setSpecKey } from "../api";
import { useCompany } from "../company";

/** Both demo tenants' keys, kept so switching between them is a click rather
 * than another round of copy-paste. Same browser-local storage the active key
 * already uses; these are throwaway local-demo credentials by construction
 * (the endpoint that mints them refuses to run unless the demo path is on). */
const DEMO_KEYS = "we-demo-keys";
type DemoKeys = { clientA?: string; sampleGenome?: string };

function readDemoKeys(): DemoKeys {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEYS) || "{}") as DemoKeys;
  } catch {
    return {};
  }
}

function writeDemoKeys(next: DemoKeys) {
  try {
    localStorage.setItem(DEMO_KEYS, JSON.stringify(next));
  } catch {
    /* private browsing — the buttons just won't be offered next reload */
  }
}

type BootstrapResult = {
  client_a_id: number;
  api_key: string | null;
  sample_genome_client_id: number;
  sample_genome_api_key: string | null;
  census: { units: number; gaps: number } | null;
  sample_genome_import: { version_id: number | null; gqs: number | null; accepted: boolean };
};

/** One button that stands the demo up.
 *
 * Setup used to mean: run a curl in a terminal, read a 32-character key out of
 * a JSON blob, and paste it into a banner — for each of two tenants. That is
 * the most fragile part of any live demo and none of it needed a human. This
 * calls the same POST /api/demo/bootstrap and stores the key itself.
 *
 * The endpoint is gated by DEMO_BOOTSTRAP_ENABLED, so where the demo path is
 * turned off this reports that rather than pretending to work. */
export function DemoSetup() {
  const { reload, keyClientId, clients } = useCompany();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<DemoKeys>({});

  useEffect(() => setKeys(readDemoKeys()), []);

  async function run(forceNewKeys: boolean) {
    setBusy(true);
    setError(null);
    try {
      // A key's plaintext exists only at the moment it is minted, so a tenant
      // that already has one returns null and this browser would be left
      // signed out — the exact dead end this button exists to remove. When we
      // are not already holding a usable key, ask for fresh ones so "set up
      // the demo" always ends signed in. If we do hold one, leave it alone
      // rather than churning a credential that is working.
      const holdsUsableKey = Boolean(readDemoKeys().clientA) && keyClientId !== null;
      const newKeys = forceNewKeys || !holdsUsableKey;

      const body = await api.post<BootstrapResult>(
        `/demo/bootstrap${newKeys ? "?new_keys=true" : ""}`,
      );
      setResult(body);

      // Keep whichever keys came back; a re-run without new_keys returns null
      // for a tenant that already had one, and must not erase what we hold.
      const merged: DemoKeys = {
        clientA: body.api_key ?? keys.clientA,
        sampleGenome: body.sample_genome_api_key ?? keys.sampleGenome,
      };
      setKeys(merged);
      writeDemoKeys(merged);

      // Adopt Client A's key; setSpecKey re-resolves the company context, so
      // the switcher follows without a reload.
      if (merged.clientA) setSpecKey(merged.clientA);
      else reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(keys.clientA) || keyClientId !== null;
  const currentName = clients.find((c) => c.id === keyClientId)?.name;

  return (
    <section className="card demo-setup">
      <h3>Demo setup</h3>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 13 }}>
        Seeds the Client A HR census, imports the sample genome into its own tenant, and issues the API keys
        both need — then signs this browser in as Client A. No terminal, nothing to copy.
      </p>

      {error && <div className="banner error">{error}</div>}

      <div className="toolbar">
        <button type="button" className="primary" disabled={busy} onClick={() => void run(false)}>
          {busy ? "Setting up…" : ready ? "Re-run setup" : "Set up the demo"}
        </button>
        {ready && (
          <button type="button" disabled={busy} onClick={() => void run(true)}>
            Issue fresh keys
          </button>
        )}
      </div>

      {(keys.clientA || keys.sampleGenome) && (
        <div className="demo-tenants">
          <span className="demo-tenants-label">Work as</span>
          <button
            type="button"
            disabled={busy || !keys.clientA}
            aria-pressed={currentName === "Client A"}
            onClick={() => keys.clientA && setSpecKey(keys.clientA)}
          >
            Client A {currentName === "Client A" && "✓"}
          </button>
          <button
            type="button"
            disabled={busy || !keys.sampleGenome}
            aria-pressed={currentName === "Sample Genome Co"}
            onClick={() => keys.sampleGenome && setSpecKey(keys.sampleGenome)}
          >
            Sample Genome Co {currentName === "Sample Genome Co" && "✓"}
          </button>
        </div>
      )}

      {result && (
        <div className="banner ok" style={{ marginTop: 12, marginBottom: 0 }}>
          <div>
            <strong>Ready.</strong>{" "}
            {result.census && <>Client A census: {result.census.units} work units, {result.census.gaps} gaps. </>}
            {result.sample_genome_import.version_id !== null && (
              <>
                Sample genome v{result.sample_genome_import.version_id} imported at GQS{" "}
                {result.sample_genome_import.gqs}.{" "}
              </>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            {result.api_key
              ? "This browser is now signed in as Client A."
              : "Reusing the key this browser already holds."}{" "}
            Switch tenants with the buttons above, or from the API key panel in the sidebar.
          </div>
        </div>
      )}
    </section>
  );
}
