import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { useCompany } from "../company";
import { NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import {
  OPS_ANSWER_IDS,
  SAMPLE_FIELD_LABEL,
  sampleTextFor,
  useDemoSampleOn,
} from "../lib/demoSampleSeats";
import type { OfferDeskSeatKey } from "../lib/offerDeskSeats";
import { OPS_EMPTY_SLOTS } from "../lib/offerDeskSeats";
import {
  CORE_ANSWER_IDS,
  QUESTION_COPY,
  getSittingAnswers,
  type CoreAnswerId,
} from "../lib/sittingAnswers";
import type { SittingAnswer } from "../types";

const NONE_YET = "none yet";
const LOOKING_ONLY = "Looking only — this walk stored nothing. Confirm and Correct stay on Sit close.";

const TOPIC_LABELS: Record<CoreAnswerId, string> = {
  pain: "What broke",
  so_what: "Who owns that",
  this_period: "This period",
  in_out: "In and out",
  who_binds: "Who may bind",
};

const COLUMNS: { seat: OfferDeskSeatKey; heading: string }[] = [
  { seat: "function_head", heading: "Function leader" },
  { seat: "sub_function_lead", heading: "Sub-function lead" },
  { seat: "sme", heading: "Rashmi" },
];

function storedCell(answers: SittingAnswer[], id: string): string {
  return answers.find((row) => row.id === id)?.text.trim() ?? "";
}

function cellDisplay(
  answers: SittingAnswer[],
  seat: OfferDeskSeatKey,
  id: string,
  answersStatus: "pending" | "loading" | "ready" | "error",
  hasError: boolean,
  sampleOn: boolean,
): { text: string; sample: boolean } {
  if (answersStatus === "error" || hasError) return { text: "Could not load this walk.", sample: false };
  if (answersStatus !== "ready") return { text: "Opening this walk…", sample: false };
  const stored = storedCell(answers, id);
  if (stored) return { text: stored, sample: false };
  if (sampleOn) {
    const sample = sampleTextFor(seat, id);
    if (sample) return { text: sample, sample: true };
  }
  return { text: NONE_YET, sample: false };
}

function storedAnswerList(answers: SittingAnswer[]): SittingAnswer[] {
  return answers.filter((row) => row.text.trim());
}

export default function OfferDeskPlayback() {
  const chro = useOfferDeskSeat("function_head");
  const ops = useOfferDeskSeat("sub_function_lead");
  const rashmi = useOfferDeskSeat("sme");
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();
  const sampleOn = useDemoSampleOn();
  const guestSettled = isGuest && !firstLoadPending;
  const hooks = {
    function_head: chro,
    sub_function_lead: ops,
    sme: rashmi,
  };

  const [chroAnswers, setChroAnswers] = useState<SittingAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [answersStatus, setAnswersStatus] = useState<"pending" | "loading" | "ready" | "error">("pending");
  const sessionId = chro.session?.id ?? null;

  useEffect(() => {
    if (firstLoadPending) {
      setAnswersStatus("pending");
      return;
    }
    if (isGuest) {
      setChroAnswers([]);
      setError(null);
      setNeedsKey(false);
      setAnswersStatus("ready");
    }
  }, [firstLoadPending, isGuest]);

  useEffect(() => {
    if (firstLoadPending || isGuest || sessionId != null) return;
    setChroAnswers([]);
    setAnswersStatus(chro.busy ? "loading" : "ready");
  }, [firstLoadPending, isGuest, sessionId, chro.busy]);

  useEffect(() => {
    if (firstLoadPending || isGuest || sessionId == null) return;
    let cancelled = false;
    setAnswersStatus("loading");
    getSittingAnswers(sessionId)
      .then((body) => {
        if (cancelled) return;
        setChroAnswers(body.answers ?? []);
        setNeedsKey(false);
        setError(null);
        setAnswersStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setChroAnswers([]);
        if (err instanceof NeedsApiKeyError) {
          setNeedsKey(true);
          setAnswersStatus("ready");
        } else {
          setError(errorMessage(err));
          setAnswersStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [firstLoadPending, isGuest, sessionId]);

  const bySeat: Record<OfferDeskSeatKey, SittingAnswer[]> = {
    function_head: chroAnswers,
    sub_function_lead: [],
    sme: [],
  };

  const stored = storedAnswerList(chroAnswers);
  const sampleOnly = sampleOn && stored.length === 0 && !error && answersStatus === "ready";
  const settledEmpty = answersStatus === "ready" && stored.length === 0 && !sampleOn && !error;
  const anchorTopics = [
    ...new Set(stored.filter((row) => row.id.startsWith("anchor:")).map((row) => row.id)),
  ].map((id) => ({
    id,
    label: id.slice("anchor:".length).replace(/_/g, " "),
  }));
  const opsTopics = sampleOn
    ? OPS_EMPTY_SLOTS.filter((slot) => (OPS_ANSWER_IDS as readonly string[]).includes(slot.id)).map((slot) => ({
        id: slot.id,
        label: slot.label,
        question: slot.label,
      }))
    : [];
  const topics = [
    ...CORE_ANSWER_IDS.map((id) => ({ id, label: TOPIC_LABELS[id], question: QUESTION_COPY[id] })),
    ...opsTopics,
    ...anchorTopics.map((row) => ({ id: row.id, label: row.label, question: row.label })),
  ];

  const given = stored.length
    ? stored.map((row) => row.text.trim()).join(" ")
    : sampleOnly
      ? "Sample from Rashmi's sitting. Not a named leader."
      : settledEmpty
        ? "Nothing stored in this walk yet."
        : "Opening this walk…";
  const output = settledEmpty
    ? NONE_YET
    : stored.length
      ? stored.map((row) => row.text.trim()).join(" ")
      : sampleOnly
        ? SAMPLE_FIELD_LABEL
        : "Opening this walk…";
  const processed = guestSettled
    ? "Looking only. This page does not save. Confirm and Correct stay on Sit close."
    : sampleOnly
      ? "Only sample is on the glass. We did not PUT it as a named sitting."
      : "We show the sentences this walk stored. Empty cells stay empty. We do not fill them from a canned row.";

  return (
    <div data-testid="playback">
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · three seats, not one story
      </p>
      <h2>
        Playback · three seats{" "}
        <InfoTooltip
          term="Playback"
          simple="Playback puts the three sittings side by side on the same topics. We do not vote them into one story. Why: the leader, the desk lead, and Rashmi often disagree; the product is to see that, not to hide it."
          technical="GET /api/scout/sessions/{id}/sitting-answers for the function leader sitting. Empty cells are none yet. Guest never calls this. Confirm and Correct stay on Sit close — no second table."
        />
      </h2>
      <p className="lede">We do not vote the rows into one story. Empty stays empty.</p>
      <SeatStepper />

      {(chro.needsKey || ops.needsKey || rashmi.needsKey || needsKey) && !isGuest && (
        <ApiKeyBanner
          onSaved={() => {
            void chro.retry();
            void ops.retry();
            void rashmi.retry();
          }}
        />
      )}
      {error && (
        <div className="banner error" data-testid="playback-error">
          {error}
        </div>
      )}
      {guestSettled && (
        <p className="hint" data-testid="playback-guest">
          {LOOKING_ONLY}
        </p>
      )}
      {settledEmpty && (
        <p style={{ fontSize: 15, margin: "0 0 16px" }} data-testid="playback-empty">
          {NONE_YET}
        </p>
      )}
      {sampleOnly && (
        <p className="hint" style={{ margin: "0 0 16px" }} data-testid="playback-sample-only">
          {SAMPLE_FIELD_LABEL}
        </p>
      )}
      {(answersStatus === "pending" || answersStatus === "loading") && (
        <p className="hint" data-testid="playback-loading">
          Opening this walk…
        </p>
      )}

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {COLUMNS.map((col) => {
          const hook = hooks[col.seat];
          return (
            <SeatSessionBar
              key={col.seat}
              seat={col.seat}
              session={hook.session}
              needsKey={hook.needsKey}
              error={hook.error}
              busy={hook.busy}
              onRetry={hook.retry}
              showKeyBanner={false}
            />
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 id="playback-topics-heading">Same topics, three answers</h3>
        <div className="table-wrap" style={{ marginBottom: 0 }}>
          <table data-testid="playback-table" aria-labelledby="playback-topics-heading">
            <thead>
              <tr>
                <th scope="col">Topic</th>
                {COLUMNS.map((col) => (
                  <th key={col.seat} scope="col">
                    {col.heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.id}>
                  <th scope="row">
                    <strong>{topic.label}</strong>
                    {topic.question !== topic.label && (
                      <div className="hint" style={{ margin: "4px 0 0", fontWeight: 400 }}>
                        {topic.question}
                      </div>
                    )}
                  </th>
                  {COLUMNS.map((col) => {
                    const cell = cellDisplay(
                      bySeat[col.seat],
                      col.seat,
                      topic.id,
                      answersStatus,
                      Boolean(error),
                      sampleOn,
                    );
                    return (
                      <td key={col.seat} data-testid={`playback-cell-${col.seat}-${topic.id}`}>
                        {cell.text}
                        {cell.sample && (
                          <div className="hint" style={{ margin: "4px 0 0" }} data-testid={`playback-sample-${col.seat}-${topic.id}`}>
                            {SAMPLE_FIELD_LABEL}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
          Confirm and Correct stay on Sit close. This page does not add a second table.
        </p>
      </div>

      <IoPanes
        given={given}
        understood="Disagreement is expected: upstairs talks outcomes, the desk talks trackers. We keep each seat in its own column."
        processed={processed}
        output={output}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/sit-close" data-testid="playback-sit-close">
          Close this sitting →
        </Link>
      </p>
    </div>
  );
}
