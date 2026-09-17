import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatSessionBar, useOfferDeskSeat } from "../components/offerDesk/SeatSessionBar";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { errorMessage } from "../api";
import { useCompany } from "../company";
import { NeedsApiKeyError } from "../lib/apiFetch";
import { useIsGuest } from "../lib/guestMode";
import { OFFER_DESK_SAMPLE_ROWS } from "../lib/offerDeskData";
import { OFFER_DESK_SEATS, type OfferDeskSeatKey } from "../lib/offerDeskSeats";
import {
  CORE_ANSWER_IDS,
  NONE_YET,
  emptyCoreAnswers,
  getSittingAnswers,
  joinAnswers,
  putSittingAnswers,
  splitAnswers,
  typedGiven,
  type CoreAnswerId,
} from "../lib/sittingAnswers";
import { INTERVIEW_TYPE_LABELS } from "../types";

const TOPIC_LABEL: Record<CoreAnswerId, string> = {
  pain: "What broke",
  so_what: "Who owns that",
  this_period: "This period",
  in_out: "In and out",
  who_binds: "Who may bind",
};

const SEAT_SITTING_HREF: Record<OfferDeskSeatKey, string> = {
  function_head: "/scout/offer-desk/function-leader",
  sub_function_lead: "/scout/offer-desk/sub-function-lead",
  sme: "/scout/offer-desk/rashmi",
};

const ASK_THE_SITTING = "ask the question on the sitting";

type SeatColumn = {
  seat: OfferDeskSeatKey;
  heading: string;
};

export default function OfferDeskPlayback() {
  const chro = useOfferDeskSeat("function_head");
  const ops = useOfferDeskSeat("sub_function_lead");
  const rashmi = useOfferDeskSeat("sme");
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();

  const columns: SeatColumn[] = [
    { seat: "function_head", heading: "CHRO stand-in" },
    { seat: "sub_function_lead", heading: "HR Ops lead" },
    { seat: "sme", heading: "Rashmi" },
  ];

  const [core, setCore] = useState(emptyCoreAnswers);
  const [anchors, setAnchors] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Record<CoreAnswerId, string>>(emptyCoreAnswers);
  const [struck, setStruck] = useState<Partial<Record<CoreAnswerId, string>>>({});
  const [settled, setSettled] = useState<Partial<Record<CoreAnswerId, "confirmed" | "corrected">>>({});
  const [settledBy, setSettledBy] = useState<Partial<Record<CoreAnswerId, string>>>({});
  const [confirmedBy, setConfirmedBy] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  const lookOnly = isGuest || firstLoadPending;
  const sessionId = chro.session?.id ?? null;
  const loadGen = useRef(0);

  const clearPlayback = useCallback(() => {
    setCore(emptyCoreAnswers());
    setAnchors({});
    setLines(emptyCoreAnswers());
    setStruck({});
    setSettled({});
    setSettledBy({});
  }, []);

  const loadAnswers = useCallback(async () => {
    const my = ++loadGen.current;
    if (lookOnly || sessionId == null) {
      clearPlayback();
      setLoadingAnswers(false);
      return;
    }
    setLoadingAnswers(true);
    setError(null);
    try {
      const body = await getSittingAnswers(sessionId);
      if (my !== loadGen.current) return;
      const split = splitAnswers(body.answers ?? []);
      setCore(split.core);
      setAnchors(split.anchors);
      setNeedsKey(false);
    } catch (err) {
      if (my !== loadGen.current) return;
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? errorMessage(err) : "Could not load stored answers.");
      clearPlayback();
    } finally {
      if (my === loadGen.current) setLoadingAnswers(false);
    }
  }, [lookOnly, sessionId, clearPlayback]);

  useEffect(() => {
    void loadAnswers();
  }, [loadAnswers]);

  function quoteFor(seat: OfferDeskSeatKey, topic: CoreAnswerId): string {
    if (seat !== "function_head") return "";
    return core[topic].trim();
  }

  async function onConfirm(topic: CoreAnswerId) {
    const name = confirmedBy.trim();
    if (lookOnly || sessionId == null || !quoteFor("function_head", topic) || !name) return;
    setBusy(`confirm-${topic}`);
    setError(null);
    try {
      await putSittingAnswers(sessionId, joinAnswers(core, anchors));
      setSettled((prev) => ({ ...prev, [topic]: "confirmed" }));
      setSettledBy((prev) => ({ ...prev, [topic]: name }));
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? errorMessage(err) : "Confirm failed");
    } finally {
      setBusy(null);
    }
  }

  async function onCorrect(topic: CoreAnswerId) {
    const name = confirmedBy.trim();
    if (lookOnly || sessionId == null || !name) return;
    const value = lines[topic].trim();
    const original = core[topic].trim();
    if (!value || value === original) return;
    setBusy(`correct-${topic}`);
    setError(null);
    const nextCore = { ...core, [topic]: value };
    try {
      await putSittingAnswers(sessionId, joinAnswers(nextCore, anchors));
      setCore(nextCore);
      setStruck((prev) => ({ ...prev, [topic]: original }));
      setSettled((prev) => ({ ...prev, [topic]: "corrected" }));
      setSettledBy((prev) => ({ ...prev, [topic]: name }));
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? errorMessage(err) : "Correct failed");
    } finally {
      setBusy(null);
    }
  }

  const given = typedGiven(core);
  const hasAnyQuote = CORE_ANSWER_IDS.some((id) => core[id].trim());
  const waitingKeyed = !isGuest && (firstLoadPending || chro.busy || loadingAnswers);

  function retryAnswers() {
    void chro.retry();
    void ops.retry();
    void rashmi.retry();
    void loadAnswers();
  }

  return (
    <div data-testid="playback">
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · three seats, not one story
      </p>
      <h2>
        Playback · three seats{" "}
        <InfoTooltip
          term="Playback"
          simple="Playback puts the three sittings side by side on the same topics. Empty stays empty. We do not vote them into one story. Why: the leader, the desk lead, and Rashmi often disagree; the product is to see that, not to hide it."
          technical="GET /scout/sessions/{id}/sitting-answers on the function_head sitting. Canned playback rows are not the source once stored text exists. Confirm PUTs the same sentence — no second confirm API. Correct PUTs a different line; strike-through of what they first said stays on this page. Guest never calls these."
        />
      </h2>
      <p className="lede">We do not vote the rows into one story. Empty stays empty.</p>
      <SeatStepper />

      {(chro.needsKey || ops.needsKey || rashmi.needsKey || needsKey) && !isGuest && (
        <ApiKeyBanner onSaved={() => { retryAnswers(); setNeedsKey(false); }} />
      )}
      {error && (
        <div className="banner error" data-testid="playback-error">
          {error}
        </div>
      )}

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {columns.map((col) => (
          <SeatSessionBar
            key={col.seat}
            seat={col.seat}
            session={col.seat === "function_head" ? chro.session : col.seat === "sub_function_lead" ? ops.session : rashmi.session}
            needsKey={col.seat === "function_head" ? chro.needsKey : col.seat === "sub_function_lead" ? ops.needsKey : rashmi.needsKey}
            error={col.seat === "function_head" ? chro.error : col.seat === "sub_function_lead" ? ops.error : rashmi.error}
            busy={col.seat === "function_head" ? chro.busy : col.seat === "sub_function_lead" ? ops.busy : rashmi.busy}
            onRetry={col.seat === "function_head" ? chro.retry : col.seat === "sub_function_lead" ? ops.retry : rashmi.retry}
            showKeyBanner={false}
          />
        ))}
      </div>

      {!lookOnly && (
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span>Who is confirming</span>
            <input
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value)}
              placeholder="Your name"
              aria-label="Who is confirming"
              data-testid="playback-confirmed-by"
            />
          </label>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Same topics, three answers</h3>
        {waitingKeyed && (
          <p className="hint" data-testid="playback-loading">
            Opening stored answers…
          </p>
        )}
        <div className="table-wrap" style={{ marginBottom: 0 }}>
          <table data-testid="playback-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>CHRO stand-in</th>
                <th>HR Ops lead</th>
                <th>Rashmi</th>
              </tr>
            </thead>
            <tbody>
              {CORE_ANSWER_IDS.map((topic) => (
                <tr key={topic} data-testid={`playback-table-row-${topic}`}>
                  <th scope="row">{TOPIC_LABEL[topic]}</th>
                  {columns.map((col) => {
                    const text = quoteFor(col.seat, topic);
                    const struckText = col.seat === "function_head" ? struck[topic] : undefined;
                    return (
                      <td
                        key={col.seat}
                        data-testid={`playback-cell-${topic}-${col.seat}`}
                      >
                        {struckText ? (
                          <>
                            <del>{struckText}</del>
                            <div>{text}</div>
                          </>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {CORE_ANSWER_IDS.map((topic) => {
          const chroQuote = quoteFor("function_head", topic);
          const quoted = chroQuote.length > 0;
          const drafted = !settled[topic];
          const line = lines[topic];
          const canWrite = Boolean(!lookOnly && drafted && quoted && confirmedBy.trim());
          const canCorrect = canWrite && line.trim().length > 0 && line.trim() !== chroQuote;
          const struckText = struck[topic];
          return (
            <article
              key={topic}
              className="card"
              style={{ margin: 0 }}
              data-testid={`playback-row-${topic}`}
            >
              <h3 style={{ marginTop: 0 }}>{TOPIC_LABEL[topic]}</h3>
              <div className="split" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                {columns.map((col) => {
                  const text = quoteFor(col.seat, topic);
                  const showStruck = col.seat === "function_head" ? struckText : undefined;
                  return (
                    <div key={col.seat}>
                      <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
                        {col.heading}
                      </div>
                      <p style={{ fontSize: 13, margin: 0 }} data-testid={`playback-quote-${topic}-${col.seat}`}>
                        {showStruck ? (
                          <>
                            <del>{showStruck}</del>
                            <span style={{ display: "block" }}>{text}</span>
                          </>
                        ) : (
                          text
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
                    What they said
                  </div>
                  <p style={{ fontSize: 13, margin: 0 }} data-testid={`playback-said-${topic}`}>
                    {quoted ? struckText || chroQuote : ""}
                  </p>
                </div>
                <div>
                  <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
                    Draft
                  </div>
                  <p style={{ fontSize: 13, margin: 0 }} data-testid={`playback-draft-${topic}`}>
                    {quoted ? chroQuote : NONE_YET}
                  </p>
                </div>
              </div>
              {settled[topic] && (
                <span className="badge ok" data-testid={`playback-settled-${topic}`}>
                  {settled[topic] === "corrected"
                    ? `corrected — ${settledBy[topic] || "named"}`
                    : `confirmed — ${settledBy[topic] || "named"}`}
                </span>
              )}
              {!quoted ? (
                <p className="hint" style={{ marginBottom: 0 }} data-testid={`playback-ask-${topic}`}>
                  <Link to={SEAT_SITTING_HREF.function_head}>{ASK_THE_SITTING}</Link>
                </p>
              ) : (
                <div className="toolbar" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    data-testid={`playback-confirm-${topic}`}
                    disabled={!canWrite || busy !== null}
                    onClick={() => void onConfirm(topic)}
                  >
                    {busy === `confirm-${topic}` ? "Saving…" : "Confirm"}
                  </button>
                  {!lookOnly && (
                    <input
                      value={line}
                      onChange={(e) => setLines((prev) => ({ ...prev, [topic]: e.target.value }))}
                      placeholder="A different line"
                      aria-label={`${TOPIC_LABEL[topic]} — a different line`}
                      data-testid={`playback-line-${topic}`}
                      disabled={!drafted || busy !== null}
                    />
                  )}
                  <button
                    type="button"
                    data-testid={`playback-correct-${topic}`}
                    disabled={!canCorrect || busy !== null}
                    onClick={() => void onCorrect(topic)}
                  >
                    {busy === `correct-${topic}` ? "Saving…" : "Correct"}
                  </button>
                </div>
              )}
              {lookOnly && (isGuest || !waitingKeyed) && (
                <p className="hint" style={{ marginBottom: 0 }} data-testid={`playback-guest-${topic}`}>
                  {isGuest
                    ? "Guest: looking only — sign in to Confirm or Correct. Nothing is saved."
                    : "Looking only until stored answers load."}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <div className="split" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {columns.map((col) => {
          const spec = OFFER_DESK_SEATS[col.seat];
          const hook = col.seat === "function_head" ? chro : col.seat === "sub_function_lead" ? ops : rashmi;
          const units = hook.session?.units ?? [];
          return (
            <div key={col.seat} className="card" style={{ margin: 0 }}>
              <h3>{col.heading}</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                {INTERVIEW_TYPE_LABELS[spec.type]}
                {spec.standIn ? " · stand-in" : " · real sitting"}
              </p>
              {spec.standIn && units.length === 0 && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Empty on purpose. A labelled stand-in is not a captured grid. We do not fill it to look complete.
                </p>
              )}
              {!spec.standIn && units.length === 0 && (
                <>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                    {OFFER_DESK_SAMPLE_ROWS.map((r) => (
                      <li key={r.name} style={{ marginBottom: 6 }}>
                        <strong>{r.name}</strong>
                        {r.time_minutes != null && <> · {r.time_minutes} min (sheet)</>}
                        {r.pain ? <div className="hint" style={{ margin: "2px 0 0" }}>{r.pain}</div> : null}
                      </li>
                    ))}
                  </ul>
                  <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                    From the sheet, not the live capture grid — sign in to open a real sitting.
                  </p>
                </>
              )}
              {units.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                  {units.map((u) => (
                    <li key={u.id} style={{ marginBottom: 6 }}>
                      <strong>{u.name}</strong>
                      {u.time_minutes != null && <> · {u.time_minutes} min (grid)</>}
                      {u.pain ? <div className="hint" style={{ margin: "2px 0 0" }}>{u.pain}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <IoPanes
        given={hasAnyQuote ? given : "Nothing typed yet."}
        understood="Disagreement stays in its own column. Empty stays empty. We do not fill a seat to look complete."
        processed={
          lookOnly
            ? "Typing stays in this walk. Stored answers are not loaded. Confirm stays off."
            : "We play back what is stored on the sitting. Confirm keeps their words. Correct writes a different line."
        }
        output={hasAnyQuote ? given : NONE_YET}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/sit-close">Close this sitting →</Link>
      </p>
    </div>
  );
}
