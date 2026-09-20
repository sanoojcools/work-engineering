import { useEffect, useState } from "react";
import { ApiKeyBanner } from "../ApiKeyBanner";
import { InfoTooltip } from "../InfoTooltip";
import { IoPanes } from "../IoPanes";
import { errorMessage } from "../../api";
import { NeedsApiKeyError } from "../../lib/apiFetch";
import { useCompany } from "../../company";
import { useIsGuest } from "../../lib/guestMode";
import { confirmStrategyIntent, ensureOfferToOnboardingWorkSystem } from "../../lib/workSystem";
import {
  CORE_ANSWER_IDS,
  DRAFT_FOCUS_MIN,
  GUEST_SITTING_LOOK,
  NONE_YET,
  QUESTION_COPY,
  SITTING_STEPS,
  STRATEGY_INTENT_INFO,
  THIS_PERIOD_DRAFT,
  USE_AS_LINE,
  draftStrategyIntent,
  emptyCoreAnswers,
  getHardAnchors,
  getSittingAnswers,
  joinAnswers,
  lastUsableSentence,
  putSittingAnswers,
  splitAnswers,
  typedGiven,
  focusInAnswers,
  type CoreAnswerId,
  type SittingStep,
} from "../../lib/sittingAnswers";
import type { HardAnchor, WorkSystem } from "../../types";

export function ChroSitting({
  sessionId,
  workSystem,
  onWorkSystem,
}: {
  sessionId: number | null;
  workSystem: WorkSystem | null;
  onWorkSystem: (ws: WorkSystem) => void;
}) {
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();
  const [step, setStep] = useState<SittingStep>("pain");
  const [core, setCore] = useState(emptyCoreAnswers);
  const [anchors, setAnchors] = useState<Record<string, string>>({});
  const [packAnchors, setPackAnchors] = useState<HardAnchor[]>([]);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftStatus, setDraftStatus] = useState<"draft" | "confirmed">("draft");
  const [confirmedBy, setConfirmedBy] = useState("");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  const lookOnly = isGuest || firstLoadPending;
  const stepIndex = SITTING_STEPS.indexOf(step);
  const isCoreStep = (CORE_ANSWER_IDS as readonly string[]).includes(step);
  const currentText = isCoreStep ? core[step as CoreAnswerId] : "";
  const liveDraft = lastUsableSentence(core, isCoreStep ? currentText : core.this_period);
  const shownDraft = draftLabel || (lookOnly && liveDraft.length >= DRAFT_FOCUS_MIN ? liveDraft : "");
  const confirmed = draftStatus === "confirmed";
  const given = typedGiven(core);

  useEffect(() => {
    let cancelled = false;
    getHardAnchors()
      .then((pack) => {
        if (!cancelled) setPackAnchors(pack.anchors ?? []);
      })
      .catch(() => {
        if (!cancelled) setPackAnchors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isGuest || firstLoadPending || sessionId == null) return;
    let cancelled = false;
    getSittingAnswers(sessionId)
      .then((body) => {
        if (cancelled) return;
        const split = splitAnswers(body.answers ?? []);
        setCore((prev) => {
          const next = { ...split.core };
          for (const id of CORE_ANSWER_IDS) {
            if (prev[id].trim()) next[id] = prev[id];
          }
          return next;
        });
        setAnchors((prev) => ({ ...split.anchors, ...prev }));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof NeedsApiKeyError) setNeedsKey(true);
        else setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, firstLoadPending, sessionId]);

  useEffect(() => {
    if (!workSystem) return;
    const intent = workSystem.strategy_intent;
    const label = intent.label?.trim() ?? "";
    if (intent.status === "confirmed" && label) {
      setDraftLabel(label);
      setDraftStatus("confirmed");
      setConfirmedBy(intent.confirmed_by);
      setConfirmedAt(intent.confirmed_at);
      return;
    }
    if (!focusInAnswers(label, joinAnswers(core, anchors))) return;
    setDraftLabel(label);
    setDraftStatus(intent.status);
    setConfirmedBy(intent.confirmed_by);
    setConfirmedAt(intent.confirmed_at);
  }, [workSystem, core, anchors]);

  function setCurrentText(value: string) {
    if (!isCoreStep) return;
    setCore((prev) => ({ ...prev, [step]: value }));
  }

  async function persist(nextCore = core, nextAnchors = anchors) {
    if (lookOnly || firstLoadPending || sessionId == null) return;
    await putSittingAnswers(sessionId, joinAnswers(nextCore, nextAnchors));
  }

  async function goNext() {
    setError(null);
    try {
      await persist();
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(errorMessage(err));
      return;
    }
    if (stepIndex < SITTING_STEPS.length - 1) setStep(SITTING_STEPS[stepIndex + 1]);
  }

  function goBack() {
    if (stepIndex > 0) setStep(SITTING_STEPS[stepIndex - 1]);
  }

  async function toggleAnchor(anchor: HardAnchor, checked: boolean) {
    const next = { ...anchors };
    if (checked) next[anchor.key] = anchor.prompt;
    else delete next[anchor.key];
    setAnchors(next);
    try {
      await persist(core, next);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(errorMessage(err));
    }
  }

  async function useAsLine(focus = liveDraft) {
    const sentence = focus.trim();
    if (sentence.length < DRAFT_FOCUS_MIN) return;
    setBusy(true);
    setError(null);
    const nextCore =
      core.this_period.trim().length >= DRAFT_FOCUS_MIN
        ? core
        : { ...core, this_period: sentence };
    if (nextCore !== core) setCore(nextCore);
    if (lookOnly) {
      setDraftLabel(sentence);
      setDraftStatus("draft");
      setEditing(false);
      setBusy(false);
      return;
    }
    if (sessionId == null) {
      setBusy(false);
      setError("Sign in to save this period's line.");
      return;
    }
    try {
      await persist(nextCore, anchors);
      let ws = workSystem;
      if (!ws) {
        ws = await ensureOfferToOnboardingWorkSystem();
        onWorkSystem(ws);
      }
      ws = await draftStrategyIntent(ws.id, sentence, sessionId);
      onWorkSystem(ws);
      setDraftLabel(ws.strategy_intent.label);
      setDraftStatus(ws.strategy_intent.status);
      setConfirmedBy(ws.strategy_intent.confirmed_by);
      setConfirmedAt(ws.strategy_intent.confirmed_at);
      setEditing(false);
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    await useAsLine(editText);
  }

  async function confirm() {
    if (lookOnly || !workSystem || !confirmName.trim() || confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const ws = await confirmStrategyIntent(workSystem.id, confirmName.trim());
      onWorkSystem(ws);
      setDraftLabel(ws.strategy_intent.label);
      setDraftStatus(ws.strategy_intent.status);
      setConfirmedBy(ws.strategy_intent.confirmed_by);
      setConfirmedAt(ws.strategy_intent.confirmed_at);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const heard = isCoreStep && currentText.trim() ? currentText.trim() : "";
  const question = isCoreStep ? QUESTION_COPY[step as CoreAnswerId] : "These are on our HR pack. Confirm or not.";
  const confirmDisabled = lookOnly || busy || confirmed || !confirmName.trim() || !shownDraft;

  const ioOutput = shownDraft || NONE_YET;
  const understood =
    "The last hire that broke is the start. We play their words back. We do not add days they did not say.";
  const processed = lookOnly
    ? "Typing stays in this walk. Nothing is saved. Confirm stays off."
    : "We save what they typed. The draft line is a sentence from those answers, not a made-up number.";

  return (
    <>
      {needsKey && !lookOnly && <ApiKeyBanner onSaved={() => setNeedsKey(false)} />}
      {error && (
        <div className="banner error" data-testid="sitting-error">
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }} data-testid="chro-sitting">
        <h3 style={{ marginTop: 0 }}>Start sitting</h3>
        {stepIndex > 0 && (
          <p className="hint" style={{ marginTop: 0 }}>
            Question {stepIndex + 1} of {SITTING_STEPS.length}
          </p>
        )}
        <p
          style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}
          data-testid={step === "pain" ? "sitting-pain" : "sitting-question"}
        >
          {question}
        </p>

        {isCoreStep ? (
          <textarea
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            rows={4}
            style={{ width: "100%", boxSizing: "border-box" }}
            aria-label={question}
            data-testid="sitting-answer"
          />
        ) : (
          <div className="stack" style={{ gap: 10 }} data-testid="sitting-anchors">
            {packAnchors.length === 0 && (
              <p className="hint" style={{ margin: 0 }}>
                No pack checks in this walk.
              </p>
            )}
            {packAnchors.map((anchor) => (
              <label
                key={anchor.key}
                style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(anchors[anchor.key])}
                  onChange={(e) => void toggleAnchor(anchor, e.target.checked)}
                  data-testid={`sitting-anchor-${anchor.key}`}
                />
                <span>
                  <strong>{anchor.label}</strong>
                  <span className="hint" style={{ display: "block", margin: "2px 0 0" }}>
                    {anchor.prompt}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {heard && (
          <p className="hint" style={{ marginBottom: 0 }} data-testid="sitting-heard">
            We heard: {heard} Wrong?
          </p>
        )}

        <div className="toolbar" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={goBack} disabled={stepIndex === 0} data-testid="sitting-back">
            Back
          </button>
          {stepIndex < SITTING_STEPS.length - 1 && (
            <button type="button" onClick={() => void goNext()} data-testid="sitting-next">
              Next
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={
              busy ||
              firstLoadPending ||
              liveDraft.length < DRAFT_FOCUS_MIN ||
              confirmed ||
              (!lookOnly && sessionId == null)
            }
            onClick={() => void useAsLine()}
            data-testid="sitting-use-as-line"
          >
            {busy ? "Saving…" : USE_AS_LINE}
          </button>
        </div>
      </div>

      {shownDraft ? (
        <div className="card" style={{ marginBottom: 16 }} data-testid="this-period-draft">
          <p style={{ fontSize: 15, margin: 0 }}>
            <strong>{confirmed ? "This period" : THIS_PERIOD_DRAFT}</strong>{" "}
            <InfoTooltip
              term={STRATEGY_INTENT_INFO.term}
              simple={STRATEGY_INTENT_INFO.simple}
              technical={STRATEGY_INTENT_INFO.technical}
            />
          </p>
          {editing && !confirmed ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", marginTop: 10 }}
              aria-label="This period (draft)"
              data-testid="this-period-edit-text"
            />
          ) : (
            <p style={{ fontSize: 15, margin: "8px 0 0" }} data-testid="this-period-label">
              {shownDraft}
            </p>
          )}
          {confirmed ? (
            <p className="hint" style={{ marginBottom: 0 }} data-testid="this-period-confirmed">
              Confirmed by {confirmedBy} at {confirmedAt}. Persisted — survives a refresh.
            </p>
          ) : (
            <div className="toolbar" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {editing ? (
                <button type="button" className="primary" disabled={busy} onClick={() => void saveEdit()} data-testid="this-period-save-edit">
                  {busy ? "Saving…" : "Save"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditText(shownDraft);
                    setEditing(true);
                  }}
                  data-testid="this-period-edit"
                >
                  Edit
                </button>
              )}
              {!lookOnly && (
                <input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Confirm this period — your name"
                  data-testid="this-period-confirmed-by"
                />
              )}
              <button
                type="button"
                disabled={confirmDisabled}
                onClick={() => void confirm()}
                data-testid="this-period-confirm"
              >
                Confirm
              </button>
            </div>
          )}
              {lookOnly && (
                <p className="hint" style={{ marginBottom: 0 }} data-testid="sitting-guest">
                  {GUEST_SITTING_LOOK}
                </p>
              )}
        </div>
      ) : (
        <p className="hint" data-testid="this-period-none">
          This period: {NONE_YET}
        </p>
      )}

      <IoPanes given={given} understood={understood} processed={processed} output={ioOutput} />
    </>
  );
}
