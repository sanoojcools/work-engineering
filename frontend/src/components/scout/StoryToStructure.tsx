import { useState } from "react";
import { apiFetch, NeedsApiKeyError } from "../../lib/apiFetch";

export type StoryChunk = {
  text: string;
  suggested_name: string;
  inputs?: string;
  outputs?: string;
  systems?: string;
  frequency?: string;
  pain?: string;
  handoffs?: string;
  decision_rule?: string;
  time_minutes?: number | null;
};
type Extracted = { used_llm: boolean; chunks: StoryChunk[]; note: string };

const SAMPLE_STORY =
  "Last Tuesday a candidate accepted our offer, so I collected their joining documents into the HRIS. " +
  "That takes me about 20 minutes each time and I do it maybe 12 times a week. " +
  "Then I verify every document against the signed offer — if anything is missing I chase the recruiter, " +
  "which is the painful part because there's no tracker. " +
  "Once it's verified I create the employee master record in Workday and hand off to IT for access provisioning.";

/** `onAdd` lets an extracted chunk become a Work Capture Grid row directly.
 * Without it the panel could only ever *show* structure the interviewer then
 * retyped by hand, which is the opposite of the point. */
export function StoryToStructure({
  onNeedsKey,
  onAdd,
}: {
  onNeedsKey: () => void;
  onAdd?: (chunk: StoryChunk) => Promise<void> | void;
}) {
  const [story, setStory] = useState("");
  const [result, setResult] = useState<Extracted | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [addingAll, setAddingAll] = useState(false);

  async function extract() {
    if (!story.trim()) return;
    setBusy(true);
    setAdded(new Set());
    try {
      const r = await apiFetch.post<Extracted>("/scout/extract-from-story", { transcript_chunk: story });
      setResult(r);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) onNeedsKey();
    } finally {
      setBusy(false);
    }
  }

  async function addOne(chunk: StoryChunk, index: number) {
    if (!onAdd || added.has(index)) return;
    await onAdd(chunk);
    setAdded((prev) => new Set(prev).add(index));
  }

  async function addAll() {
    if (!onAdd || !result) return;
    setAddingAll(true);
    try {
      for (let i = 0; i < result.chunks.length; i++) {
        if (added.has(i)) continue;
        // Sequential: each add re-reads the session's recomputed completeness,
        // and the meter should visibly climb rather than jump once at the end.
        await addOne(result.chunks[i], i);
      }
    } finally {
      setAddingAll(false);
    }
  }

  const structured = Boolean(result?.used_llm);
  const remaining = result ? result.chunks.length - added.size : 0;

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
        Paste or dictate a few sentences of story, in the interviewee's own words. Every span shown below is
        checked against your text — anything not quoted verbatim is discarded rather than shown.
      </p>

      <textarea
        rows={4}
        value={story}
        onChange={(e) => setStory(e.target.value)}
        placeholder={SAMPLE_STORY}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button type="button" className="primary" disabled={busy || !story.trim()} onClick={extract}>
          {busy ? "Extracting…" : "Extract work units"}
        </button>
        <button type="button" onClick={() => setStory(SAMPLE_STORY)} disabled={busy}>
          Use sample story
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div className={`banner ${structured ? "ok" : "warn"}`} style={{ marginBottom: 12 }}>
            {result.note}
          </div>

          {result.chunks.length === 0 && (
            <p className="muted">Nothing here described concrete work.</p>
          )}

          {onAdd && result.chunks.length > 0 && remaining > 0 && (
            <div className="toolbar">
              <button type="button" className="primary" disabled={addingAll} onClick={() => void addAll()}>
                {addingAll ? "Adding…" : `Add all ${remaining} to the grid`}
              </button>
            </div>
          )}

          <div className="stack">
            {result.chunks.map((c, i) => (
              <div key={i} className="story-chunk">
                <div className="story-chunk-quote">“{c.text}”</div>
                <div className="story-chunk-body">
                  <div className="story-chunk-name">{c.suggested_name}</div>
                  {structured && (
                    <dl className="story-fields">
                      <Field label="Inputs" value={c.inputs} />
                      <Field label="Outputs" value={c.outputs} />
                      <Field label="Systems" value={c.systems} />
                      <Field label="Frequency" value={c.frequency} />
                      <Field label="Pain" value={c.pain} />
                      <Field label="Handoffs" value={c.handoffs} />
                      <Field label="Rule" value={c.decision_rule} />
                      <Field label="Time" value={c.time_minutes ? `${c.time_minutes} min` : ""} />
                    </dl>
                  )}
                  {onAdd && (
                    <button
                      type="button"
                      disabled={added.has(i) || addingAll}
                      onClick={() => void addOne(c, i)}
                      style={{ marginTop: 8 }}
                    >
                      {added.has(i) ? "Added ✓" : "Add to grid"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders "not stated" rather than an empty cell — a blank field here means
 * the transcript didn't say, and that is a finding worth seeing. */
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={value ? undefined : "story-field-empty"}>{value || "not stated"}</dd>
    </>
  );
}
