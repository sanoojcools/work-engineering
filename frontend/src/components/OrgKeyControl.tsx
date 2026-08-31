import { useState } from "react";
import { getSpecKey, setSpecKey } from "../api";
import { useCompany } from "../company";

const PLACEHOLDER_KEY = "dev-spec-key-change-me";

/** Shows which tenant the session is authenticated as, and lets the key be
 * changed at any time.
 *
 * ApiKeyBanner only appears on a 401, so once a working key was stored there
 * was no way to switch to a different tenant's key from the UI at all —
 * you had to clear localStorage by hand. That makes any demo or support
 * session that spans two tenants impossible to drive from the app. */
export function OrgKeyControl() {
  const { clients, keyClientId } = useCompany();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const keyCompany = clients.find((c) => c.id === keyClientId);
  const stored = getSpecKey();
  const hasKey = stored !== PLACEHOLDER_KEY && stored.length > 0;

  function save() {
    if (!value.trim()) return;
    setSpecKey(value.trim());   // company context re-resolves on this event
    setValue("");
    setEditing(false);
  }

  return (
    <div className="org-key">
      <div className="org-key-row">
        <span className="org-key-label">API key</span>
        <button type="button" className="org-key-edit" onClick={() => setEditing((e) => !e)}>
          {editing ? "Cancel" : hasKey ? "Change" : "Add"}
        </button>
      </div>

      {!editing && (
        <div className="org-key-status">
          {keyCompany ? (
            <>Authenticated as <strong>{keyCompany.name}</strong></>
          ) : hasKey ? (
            <span className="org-key-bad">Key not recognised</span>
          ) : (
            <span className="org-key-bad">No key set</span>
          )}
        </div>
      )}

      {editing && (
        <div className="org-key-form">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            placeholder="paste org key"
            aria-label="Org API key"
            autoFocus
          />
          <button type="button" className="primary" disabled={!value.trim()} onClick={save}>
            Use this key
          </button>
        </div>
      )}
    </div>
  );
}
