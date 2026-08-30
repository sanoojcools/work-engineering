import { useState } from "react";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";

type Chunk = { text: string; suggested_name: string };
type Extracted = { used_llm: boolean; chunks: Chunk[]; note: string };

export function StoryToStructure({ onNeedsKey }: { onNeedsKey: () => void }) {
  const [story, setStory] = useState("");
  const [result, setResult] = useState<Extracted | null>(null);
  const [busy, setBusy] = useState(false);

  async function extract() {
    if (!story.trim()) return;
    setBusy(true);
    try {
      const r = await apiFetch.post<Extracted>("/scout/extract-from-story", { transcript_chunk: story });
      setResult(r);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Paste or dictate a few sentences of story. This splits it into chunks you can turn into Work Capture Grid
        rows — it does not invent structure that isn't literally in what you typed (no LLM configured here; see the
        note below).
      </p>
      <textarea
        rows={4}
        value={story}
        onChange={(e) => setStory(e.target.value)}
        placeholder="Last Tuesday a client emailed asking for a refund. I checked the order in the ERP. Then I escalated it to finance..."
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button type="button" className="primary" disabled={busy || !story.trim()} onClick={extract}>
        Split into chunks
      </button>

      {result && (
        <div style={{ marginTop: 14 }}>
          <div className="banner warn" style={{ marginBottom: 10 }}>{result.note}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.chunks.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 24, textAlign: "center", color: "var(--muted)", fontSize: 12, paddingTop: 6 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13 }}>
                  {c.text}
                </div>
                <div style={{ flexShrink: 0, alignSelf: "center" }}>
                  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                    <path d="M0 7h17M12 2l6 5-6 5" />
                  </svg>
                </div>
                <div style={{ width: 200, border: "1px dashed var(--accent-line, var(--line))", padding: "8px 10px", fontSize: 12, color: "var(--muted)" }}>
                  candidate: "{c.suggested_name}"
                </div>
              </div>
            ))}
            {result.chunks.length === 0 && <p className="muted">No sentences long enough to chunk.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
