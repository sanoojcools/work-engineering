import { InfoTooltip } from "./InfoTooltip";
import type { Verdict } from "../types";
import { VERDICT_KEYS } from "../types";

/** VERDICT-CARD (HR-FAMILY v0, architecture 3d snapshot): the seven V E R D
 * I C T scores, readiness/restraint, recommended level, and applied gates
 * in everyday words, each with an i-button. Reads the same real Verdict
 * row Document check already fetches -- no second API call, no second
 * scoring engine. Renders "Not scored" rather than a fabricated number
 * when no VerdictScore row exists yet (services/verdict.py never ran for
 * this unit). This sits ALONGSIDE the existing S1/S2/S3 allocation-
 * scenario strip (lib/offerDeskScenarios.ts) -- that strip is untouched;
 * this card does not replace or duplicate it. */

const LETTER_TERMS: Record<(typeof VERDICT_KEYS)[number], { letter: string; word: string; simple: string }> = {
  verifiability: {
    letter: "V",
    word: "Verifiability",
    simple: "Can a stranger check the result is right, without asking the person who did it?",
  },
  evidence: {
    letter: "E",
    word: "Evidence",
    simple: "Is there a file, log, or record proving this happened — not just someone's word for it?",
  },
  reversibility: {
    letter: "R",
    word: "Reversibility",
    simple: "If this goes wrong, can it be undone cheaply, or is the damage permanent?",
  },
  determinism: {
    letter: "D",
    word: "Determinism",
    simple: "Does the same input always produce the same correct output, with no judgment call?",
  },
  impact_scope: {
    letter: "I",
    word: "Impact scope",
    simple: "If this goes wrong, how many people or how much money does it reach?",
  },
  compliance: {
    letter: "C",
    word: "Compliance",
    simple: "Does a law or regulation require a licensed human to do this specific step?",
  },
  tacitness: {
    letter: "T",
    word: "Tacitness",
    simple: "Is the knowledge to do this written down anywhere, or only in one person's head?",
  },
};

// Mirrors verdict.py::apply_hard_gates' four gate ids and cap values --
// stated here in plain language, not re-derived or re-numbered.
const GATE_LABELS: Record<string, string> = {
  gate1_regulatory:
    "Regulatory gate — compliance scored 1, or a licensed human is required by law. Caps at L2 (human-led, agent assists) no matter how high the other six score.",
  gate2_reversibility:
    "Reversibility gate — a mistake here can't be cheaply undone. Caps at L3 (agent-led, human approves).",
  gate3_impact:
    "Impact gate — a mistake here reaches too many people or too much money. Caps at L3 (agent-led, human approves).",
  gate4_evidence:
    "Evidence gate — evidence scored 1, or there is no evidence path at all. Caps at L2 (human-led, agent assists) — the same gate that keeps a policy stop like dual employment in place; no appetite score lifts it.",
};

function parseGates(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : [];
  } catch {
    return [];
  }
}

export function VerdictCard({ verdict, isGuest }: { verdict: Verdict | null | undefined; isGuest?: boolean }) {
  if (isGuest) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          VERDICT{" "}
          <InfoTooltip
            term="VERDICT"
            simple="Seven supply properties, 1-5 each, that decide how much of this work a robot can safely do."
          />
        </h3>
        <p className="hint" style={{ marginBottom: 0 }}>
          Guest: this reads a real, signed-in tenant's VERDICT score — not fabricated for guest viewing.
        </p>
      </div>
    );
  }

  if (!verdict) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          VERDICT{" "}
          <InfoTooltip
            term="VERDICT"
            simple="Seven supply properties, 1-5 each, that decide how much of this work a robot can safely do."
          />
        </h3>
        <p className="hint" style={{ marginBottom: 0 }}>Not scored — no VERDICT has been recorded for this record yet.</p>
      </div>
    );
  }

  const gates = parseGates(verdict.applied_gates);
  // uncapped_level is nullable on older rows only; falling back to the
  // recommended level (never higher) keeps this honest -- it claims no
  // readiness beyond what VERDICT already recommends, rather than
  // inventing a ceiling that was never computed.
  const readiness = verdict.uncapped_level ?? verdict.recommended_level;
  const restrained = readiness > verdict.recommended_level;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>
        VERDICT{" "}
        <InfoTooltip
          term="VERDICT"
          simple="Seven supply properties, 1-5 each. Lower score = harder to trust to automation. Four hard gates can cap the result regardless of the average."
        />
      </h3>
      <div className="verdict-grid" style={{ marginBottom: 12 }}>
        {VERDICT_KEYS.map((key) => (
          <div className="verdict-cell" key={key}>
            <div className="hint" style={{ marginTop: 0, marginBottom: 4, fontSize: 11 }}>
              {LETTER_TERMS[key].letter} · {LETTER_TERMS[key].word}{" "}
              <InfoTooltip term={LETTER_TERMS[key].word} simple={LETTER_TERMS[key].simple} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{verdict[key]}</div>
          </div>
        ))}
      </div>

      <dl className="story-fields graph-detail-grid">
        <dt>
          Readiness{" "}
          <InfoTooltip
            term="Readiness"
            simple="What the seven scores alone would allow, before any hard gate steps in."
            technical="Verdict.uncapped_level — verdict.py::base_level() on the mean of the seven scores, before apply_hard_gates()."
          />
        </dt>
        <dd>L{readiness} on its own seven scores.</dd>

        <dt>
          Restraint{" "}
          <InfoTooltip
            term="Restraint"
            simple="How much a hard gate is holding this back from what the scores alone would allow. No restraint means no gate fired."
            technical="uncapped_level minus recommended_level. Positive only when apply_hard_gates() actually capped the result."
          />
        </dt>
        <dd>
          {restrained
            ? `Held back from L${readiness} to L${verdict.recommended_level} by ${gates.length} hard gate${gates.length === 1 ? "" : "s"}.`
            : "None — no hard gate caps this unit below its own seven scores."}
        </dd>

        <dt>
          Recommended level{" "}
          <InfoTooltip
            term="Recommended level"
            simple="What VERDICT actually recommends today, after every hard gate is applied."
            technical="Verdict.recommended_level / level_name / allocation."
          />
        </dt>
        <dd>
          L{verdict.recommended_level} ({verdict.level_name ?? "—"}) · allocation {verdict.allocation}
        </dd>

        <dt>
          Applied gates{" "}
          <InfoTooltip
            term="Applied gates"
            simple="Which hard gates fired, in plain language — not just the ids."
            technical="Verdict.applied_gates, a JSON list of gate ids from verdict.py::apply_hard_gates."
          />
        </dt>
        <dd>
          {gates.length === 0 ? (
            "None."
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {gates.map((g) => (
                <li key={g}>{GATE_LABELS[g] ?? g}</li>
              ))}
            </ul>
          )}
        </dd>
      </dl>

      <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
        Appetite never lifts the dual-employment stop above, at any level — that stop is a policy veto, not one of
        VERDICT's four hard gates, and nothing here wires around it.
      </p>
    </div>
  );
}
