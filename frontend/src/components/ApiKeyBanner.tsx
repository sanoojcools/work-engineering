import { useState } from "react";
import { getSpecKey, setSpecKey } from "../api";

const PLACEHOLDER_KEY = "dev-spec-key-change-me";

/** Shown wherever a scout/* or genome/* call throws NeedsApiKeyError.
 *
 * "Save & retry" has to actually retry: the first version only stored the
 * key and hid the banner, so the caller was left staring at the same form
 * with nothing having happened, and had to guess that re-submitting would
 * now work. Callers pass an async `onSaved` and this awaits it, so the
 * button stays busy until the retried request settles and the banner only
 * clears once it succeeds.
 *
 * Keys are still minted server-side (POST /api/demo/bootstrap for a local
 * demo, POST /api/org/keys/rotate thereafter) — this only lets whoever
 * holds one paste it in. */
export function ApiKeyBanner({ onSaved }: { onSaved: () => void | Promise<void> }) {
  const stored = getSpecKey();
  const [value, setValue] = useState(stored === PLACEHOLDER_KEY ? "" : stored);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setSpecKey(value.trim());
    try {
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="banner warn key-banner">
      <div className="key-banner-head">
        <strong>An org API key is needed for this page.</strong>
        <span>
          Run <code>curl -X POST http://localhost:8000/api/demo/bootstrap</code> to mint one, then paste
          the <code>api_key</code> it returns below.
        </span>
      </div>
      <div className="key-banner-row">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
          }}
          placeholder="paste org key"
          aria-label="Org API key"
          autoFocus
        />
        <button className="primary" disabled={busy || !value.trim()} onClick={() => void save()}>
          {busy ? "Retrying…" : "Save & retry"}
        </button>
      </div>
    </div>
  );
}
