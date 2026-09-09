import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiKeyBanner } from "../components/ApiKeyBanner";
import { IoPanes } from "../components/IoPanes";
import { InfoTooltip } from "../components/InfoTooltip";
import { SeatStepper } from "../components/offerDesk/SeatStepper";
import { errorMessage } from "../api";
import { NeedsApiKeyError } from "../lib/apiFetch";
import { useCompany } from "../company";
import { useApi } from "../hooks";
import { useIsGuest } from "../lib/guestMode";
import {
  confirmSitCloseField,
  correctSitCloseField,
  ensureSitCloseDrafts,
  listDecisionCards,
  mergeSitCloseRows,
  pickSitCloseUnit,
  type SitCloseRowKey,
  type SitCloseRowView,
} from "../lib/fieldRatify";
import { withClient } from "../lib/withClient";
import type { DecisionCard, FieldRatification, Page, WorkUnit } from "../types";

const ROW_INFO: Record<SitCloseRowKey, { term: string; simple: string; technical: string }> = {
  goal: {
    term: "goal",
    simple: "What done looks like, in the person's own sitting, next to the draft we wrote from those words.",
    technical: "desired_condition on the Work Unit. Confirm/Correct is field ratify, not Work System ratify.",
  },
  authority: {
    term: "authority",
    simple: "Who may decide this piece of work is allowed to run.",
    technical: "authority on the Work Unit. Field ratify writes this column once.",
  },
  acceptance: {
    term: "acceptance",
    simple: "What a stranger would check to say this piece of work is actually done.",
    technical: "acceptance_criteria on the Work Unit. Field ratify writes this column once.",
  },
};

function settledLabel(row: FieldRatification): string {
  const who = row.confirmed_by || "named";
  if (row.status === "corrected") return `corrected — ${who}`;
  return `confirmed — ${who}`;
}

export default function OfferDeskSitClose() {
  const isGuest = useIsGuest();
  const { keyClientId, firstLoadPending } = useCompany();
  const unitsApi = useApi<Page<WorkUnit>>(
    isGuest || firstLoadPending ? null : withClient("/work-units/", keyClientId),
  );
  const unit = pickSitCloseUnit(unitsApi.data?.items ?? []);

  const [rows, setRows] = useState<SitCloseRowView[]>(() => mergeSitCloseRows([]));
  const [cards, setCards] = useState<DecisionCard[] | null>(null);
  const [confirmedBy, setConfirmedBy] = useState("");
  const [lines, setLines] = useState<Record<SitCloseRowKey, string>>({
    goal: "",
    authority: "",
    acceptance: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);

  async function loadLive() {
    if (firstLoadPending) return;
    if (isGuest || !unit) {
      setRows(mergeSitCloseRows([]));
      setCards([]);
      setLoadingLive(false);
      return;
    }
    setLoadingLive(true);
    setError(null);
    try {
      const drafts = await ensureSitCloseDrafts(unit.id);
      setRows(mergeSitCloseRows(drafts));
      setCards(await listDecisionCards(unit.id));
      setNeedsKey(false);
    } catch (err) {
      if (err instanceof NeedsApiKeyError) {
        setNeedsKey(true);
        setCards([]);
      } else {
        setError(err instanceof Error ? errorMessage(err) : "Could not load this sitting's drafts.");
        setCards([]);
      }
    } finally {
      setLoadingLive(false);
    }
  }

  useEffect(() => {
    void loadLive();
    // loadLive reads isGuest / unit / firstLoadPending; those are the reload keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, unit?.id, firstLoadPending]);

  function replaceRow(updated: FieldRatification) {
    setRows((current) =>
      current.map((row) =>
        row.field_name === updated.field_name
          ? { ...row, sitting_quote: updated.sitting_quote, drafted_value: updated.drafted_value, ratification: updated }
          : row,
      ),
    );
  }

  async function onConfirm(row: SitCloseRowView) {
    if (!unit || !row.ratification || !confirmedBy.trim()) return;
    setBusy(`confirm-${row.key}`);
    setError(null);
    try {
      replaceRow(await confirmSitCloseField(unit.id, row.ratification.id, confirmedBy.trim()));
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? errorMessage(err) : "Confirm failed");
    } finally {
      setBusy(null);
    }
  }

  async function onCorrect(row: SitCloseRowView) {
    if (!unit || !row.ratification || !confirmedBy.trim()) return;
    const value = lines[row.key].trim();
    if (!value || value === row.drafted_value) return;
    setBusy(`correct-${row.key}`);
    setError(null);
    try {
      replaceRow(await correctSitCloseField(unit.id, row.ratification.id, confirmedBy.trim(), value));
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else setError(err instanceof Error ? errorMessage(err) : "Correct failed");
    } finally {
      setBusy(null);
    }
  }

  function tapCard(card: DecisionCard) {
    if (card.named_human && card.named_human !== "not named") {
      setConfirmedBy(card.named_human);
    }
  }

  const lookOnly = isGuest || !unit;
  const waitingForUnit = !isGuest && (firstLoadPending || unitsApi.loading);
  const showNoneYet = isGuest || (!waitingForUnit && !loadingLive && (cards?.length ?? 0) === 0);
  const showCards = !lookOnly && !loadingLive && (cards?.length ?? 0) > 0;

  return (
    <div data-testid="sit-close">
      <p className="hint" style={{ marginBottom: 4 }}>
        Offer Desk · close this sitting
      </p>
      <h2>
        Sit close{" "}
        <InfoTooltip
          term="Sit close"
          simple="The sitting is over. Their words sit next to a draft of goal, authority, and acceptance. Confirm keeps the draft. Correct writes a different line."
          technical="POST /work-units/{id}/field-ratifications/{rid}/confirm. Field ratify of a Work Unit. Not Work System ratify, not confirm-function-intent."
        />
      </h2>
      <p className="lede">What they said, the draft, Confirm or Correct.</p>
      <SeatStepper />

      {needsKey && !isGuest && <ApiKeyBanner onSaved={() => void loadLive()} />}
      {error && <div className="banner error">{error}</div>}

      {!isGuest && !firstLoadPending && !unitsApi.loading && !unit && (
        <p className="hint" data-testid="sit-close-no-unit">
          No saved piece of work for this sitting yet. The three rows below are from the sitting.
          Confirm and Correct stay look-only until a real record exists.
        </p>
      )}

      {!lookOnly && (
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span>Who is confirming</span>
            <input
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value)}
              placeholder="Your name"
              aria-label="Who is confirming"
              data-testid="sit-close-confirmed-by"
            />
          </label>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {rows.map((row) => {
          const info = ROW_INFO[row.key];
          const drafted = row.ratification?.status === "drafted";
          const settled = row.ratification && row.ratification.status !== "drafted";
          const line = lines[row.key];
          const canWrite = Boolean(!lookOnly && drafted && row.ratification && confirmedBy.trim());
          const canCorrect = canWrite && line.trim().length > 0 && line.trim() !== row.drafted_value;
          return (
            <article
              key={row.key}
              className="card"
              style={{ margin: 0 }}
              data-testid={`sit-close-row-${row.key}`}
            >
              <h3 style={{ marginTop: 0, textTransform: "capitalize" }}>
                {row.label}{" "}
                <InfoTooltip term={info.term} simple={info.simple} technical={info.technical} />
              </h3>
              <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
                    What they said
                  </div>
                  <p style={{ fontSize: 13, margin: 0 }} data-testid={`sit-close-quote-${row.key}`}>
                    {row.sitting_quote}
                  </p>
                </div>
                <div>
                  <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
                    Draft
                  </div>
                  <p style={{ fontSize: 13, margin: 0 }} data-testid={`sit-close-draft-${row.key}`}>
                    {row.drafted_value}
                  </p>
                </div>
              </div>
              {settled && row.ratification && (
                <span className="badge ok" data-testid={`sit-close-settled-${row.key}`}>
                  {settledLabel(row.ratification)}
                </span>
              )}
              <div className="toolbar" style={{ marginTop: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  data-testid={`sit-close-confirm-${row.key}`}
                  disabled={!canWrite || busy !== null}
                  onClick={() => void onConfirm(row)}
                >
                  {busy === `confirm-${row.key}` ? "Saving…" : "Confirm"}
                </button>
                {!lookOnly && (
                  <input
                    value={line}
                    onChange={(e) => setLines((prev) => ({ ...prev, [row.key]: e.target.value }))}
                    placeholder="A different line"
                    aria-label={`${row.label} — a different line`}
                    data-testid={`sit-close-line-${row.key}`}
                    disabled={!drafted || busy !== null}
                  />
                )}
                <button
                  type="button"
                  data-testid={`sit-close-correct-${row.key}`}
                  disabled={!canCorrect || busy !== null}
                  onClick={() => void onCorrect(row)}
                >
                  {busy === `correct-${row.key}` ? "Saving…" : "Correct"}
                </button>
              </div>
              {lookOnly && (isGuest || !waitingForUnit) && (
                <p className="hint" style={{ marginBottom: 0 }} data-testid={`sit-close-guest-${row.key}`}>
                  {isGuest
                    ? "Guest: looking only — sign in to Confirm or Correct. Nothing is saved."
                    : "Looking only until a saved piece of work exists for this sitting."}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <section className="card" data-testid="sit-close-cards" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          Who should act{" "}
          <InfoTooltip
            term="Decision card"
            simple="One real gap, the named person on that piece of work, tap or a line. Empty means none yet — we do not invent a card."
            technical="GET /work-units/{id}/decision-cards. named_human is work_units.owner or the literal 'not named'. No field_name is guessed onto the card."
          />
        </h3>
        {(loadingLive || waitingForUnit) && !isGuest && (
          <p className="hint" data-testid="sit-close-cards-loading">
            Loading this tenant's cards…
          </p>
        )}
        {showNoneYet && (
          <p style={{ fontSize: 13, margin: 0 }} data-testid="sit-close-cards-empty">
            none yet
          </p>
        )}
        {showCards &&
          cards!.map((card) => (
            <div
              key={card.gap_id}
              className="card"
              style={{ margin: "0 0 10px", cursor: lookOnly ? "default" : "pointer" }}
              data-testid="sit-close-card"
              role={lookOnly ? undefined : "button"}
              tabIndex={lookOnly ? undefined : 0}
              onClick={() => {
                if (!lookOnly) tapCard(card);
              }}
              onKeyDown={(e) => {
                if (!lookOnly && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  tapCard(card);
                }
              }}
            >
              <p style={{ fontSize: 13, margin: "0 0 6px" }}>
                <strong data-testid="sit-close-card-human">{card.named_human}</strong>
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>{card.description}</p>
              {!lookOnly && (
                <p className="hint" style={{ marginBottom: 0, marginTop: 8 }}>
                  Tap to use this name, or type a line above under Who is confirming.
                </p>
              )}
            </div>
          ))}
      </section>

      <IoPanes
        given="Rashmi's sitting on document check. Goal, authority, and acceptance as she said them."
        understood="A draft is not a confirmed field. A card is only a real gap with a named human — never a stand-in invented to look complete."
        processed="Keyed Confirm and Correct write the field. Guest looks only and never mints a key."
        output="Three rows beside the quote, and either a real card or none yet."
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/scout/offer-desk/playback">Back to Playback</Link>
        {" · "}
        <Link to="/scout/offer-desk/sheet">Open what the spreadsheet gave us →</Link>
      </p>
    </div>
  );
}
