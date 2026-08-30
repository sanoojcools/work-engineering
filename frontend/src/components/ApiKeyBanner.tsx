import { useState } from "react";
import { getSpecKey, setSpecKey } from "../api";

/** Shown wherever a scout/* call throws NeedsApiKeyError. Every org key is
 * still minted by a direct org_api_keys insert (no issuance endpoint
 * exists yet -- see routers/org.py's own docstring) -- this banner just
 * lets whoever already has one paste it in, same as Spec.tsx's inline
 * key field, but reusable. */
export function ApiKeyBanner({ onSaved }: { onSaved: () => void }) {
  const [value, setValue] = useState(getSpecKey());

  return (
    <div className="banner warn" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span>Missing or invalid org API key (X-Spec-Key).</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="paste org key"
        style={{ minWidth: 220 }}
      />
      <button
        className="primary"
        onClick={() => {
          setSpecKey(value);
          onSaved();
        }}
      >
        Save &amp; retry
      </button>
    </div>
  );
}
