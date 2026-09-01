import { useEffect, useRef, useState } from "react";
import { INTERVIEW_TYPE_LABELS, INTERVIEW_TYPES } from "../../types";
import type { ScoutSession } from "../../types";

type Track = (typeof INTERVIEW_TYPES)[number];

type Question = { id: string; text: string; why: string };

const QUESTION_BANK: Record<Track, Question[]> = {
  function_head: [
    { id: "f1", text: "What does this function own that, if it broke tomorrow, the business would notice within a week?", why: "Names the highest-stakes business objects first." },
    { id: "f2", text: "Which of those are governed by a regulator, versus just internal policy?", why: "Regulatory items get stricter gates later — worth knowing now." },
    { id: "f3", text: "Which sub-functions are in scope for this census, and who leads each one?", why: "Sets the blast radius and assigns the next round of sub-function-lead interviews." },
  ],
  sub_function_lead: [
    { id: "l1", text: "Which of the sub-functions the function head named do you own, and who's on your team for each?", why: "Confirms the ownership boundary the blast-radius scoping assigned to you." },
    { id: "l2", text: "For each one, what are the two or three biggest recurring activities inside it?", why: "Seeds the initial Work Unit list before an SME session fills in the operational detail." },
    { id: "l3", text: "What systems does your team touch across those activities?", why: "Surfaces shared-resource coupling on the Work Graph before any SME session runs." },
    { id: "l4", text: "Roughly how often does each activity happen, and how many people touch it?", why: "Frequency and headcount feed the automation-index volume math and the F1 split arithmetic." },
    { id: "l5", text: "Which specialist on your team should we talk to next for the step-by-step detail?", why: "Feeds the SME roster, same purpose as the function head's question but scoped to this sub-function." },
  ],
  sme: [
    { id: "s1", text: "Walk me through what happens today, step by step — from the trigger to it being done.", why: "Trigger, current condition, and desired condition all come out of one answer." },
    { id: "s2", text: "What system or tool do you use at each step?", why: "Systems reveal automation potential." },
    { id: "s3", text: "How do you know it's actually finished — what's the evidence?", why: "Maps to evidence_required and verification_method." },
    { id: "s4", text: "What's the most annoying, manual part of this?", why: "Feeds the Pain & Exceptions dimension." },
    { id: "s5", text: "Who do you hand this off to, or receive it from?", why: "Maps to handoffs." },
  ],
};

function useSpeechRecognition(onResult: (text: string) => void) {
  const [supported] = useState(
    () => typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (!supported) return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      onResult(text);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => rec.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  return {
    supported,
    listening,
    start: () => {
      if (!recRef.current) return;
      recRef.current.start();
      setListening(true);
    },
    stop: () => {
      recRef.current?.stop();
      setListening(false);
    },
  };
}

export function DiscoveryPartner({ session }: { session: ScoutSession }) {
  const [track, setTrack] = useState<Track>(session.type);
  const [qIndex, setQIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"voice" | "type">("type");
  const speech = useSpeechRecognition(setNotes);

  const questions = QUESTION_BANK[track];
  const question = questions[qIndex];

  return (
    <div className="card">
      <h3>AI Discovery Partner</h3>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {INTERVIEW_TYPES.map((t) => (
          <button
            key={t}
            aria-selected={track === t}
            onClick={() => {
              setTrack(t);
              setQIndex(0);
            }}
          >
            {INTERVIEW_TYPE_LABELS[t]} Track
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Question {qIndex + 1} of {questions.length}
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{question.text}</div>
        <div className="hint">Why this matters: {question.why}</div>
      </div>

      <div className="toggle" style={{ display: "inline-flex", border: "1px solid var(--line)", marginBottom: 10 }}>
        <button
          aria-selected={mode === "voice"}
          style={{ background: mode === "voice" ? "var(--accent)" : undefined, color: mode === "voice" ? "#fff" : undefined, border: 0 }}
          disabled={!speech.supported}
          onClick={() => setMode("voice")}
          title={speech.supported ? "" : "Voice input isn't supported in this browser — falling back to typing"}
        >
          Speak
        </button>
        <button
          aria-selected={mode === "type"}
          style={{ background: mode === "type" ? "var(--accent)" : undefined, color: mode === "type" ? "#fff" : undefined, border: 0 }}
          onClick={() => setMode("type")}
        >
          Type
        </button>
      </div>
      {!speech.supported && <div className="hint" style={{ marginBottom: 8 }}>This browser has no built-in speech recognition — typing only.</div>}

      {mode === "voice" && speech.supported ? (
        <div style={{ marginBottom: 10 }}>
          <button type="button" onClick={speech.listening ? speech.stop : speech.start} className={speech.listening ? "primary" : undefined}>
            {speech.listening ? "● Listening — tap to stop" : "Tap to speak"}
          </button>
        </div>
      ) : null}

      <textarea
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes from this question — structure the answer into the Work Capture Grid on the right when you're done."
        style={{ width: "100%", marginBottom: 8 }}
      />
      <div className="hint" style={{ marginBottom: 12 }}>
        These notes aren't saved on their own — Scout doesn't have a live text→work-unit extractor yet (needs an
        LLM key that isn't configured). Use them as a scratchpad, then fill the grid row yourself.
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={qIndex === 0} onClick={() => { setQIndex((i) => i - 1); setNotes(""); }}>
          &larr; Previous
        </button>
        <button
          type="button"
          className="primary"
          disabled={qIndex === questions.length - 1}
          onClick={() => { setQIndex((i) => i + 1); setNotes(""); }}
        >
          Next question &rarr;
        </button>
      </div>
    </div>
  );
}
