import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, errorMessage } from "../../api";
import { useApi } from "../../hooks";
import { useCompany } from "../../company";
import { useIsGuest } from "../../lib/guestMode";
import { ApiKeyBanner } from "../ApiKeyBanner";
import { InfoTooltip } from "../InfoTooltip";
import { NeedsApiKeyError } from "../../lib/apiFetch";
import {
  FIVE_IS_THE_LIMIT,
  GUEST_TIMES_EMPTY,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  NO_TIMES_YET,
  NO_UNIT_YET,
  TIMES_INFO,
  TIMES_LABEL,
  createShadowLog,
  dateToOccurredAt,
  formatFinishDate,
  isFiveLimitError,
  parseOptionalMinutes,
  selfReportedMinutesLine,
} from "../../lib/shadowLogs";
import type { ShadowLog, ShadowSummary } from "../../types";

/** Finish times for Document check (WU-OD-02). Full on Document check,
 * short on Plan. Guest never calls the API and never mints a key. */
export function ShadowTimes({
  workUnitId,
  ready = true,
  evidencePackHref = "/scout/offer-desk/evidence-pack",
}: {
  workUnitId: number | null;
  ready?: boolean;
  evidencePackHref?: string;
}) {
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();
  const canFetch = !isGuest && !firstLoadPending && ready && workUnitId != null;
  const logsApi = useApi<ShadowLog[]>(canFetch ? `/work-units/${workUnitId}/shadow-logs` : null);
  const summaryApi = useApi<ShadowSummary>(
    canFetch ? `/work-units/${workUnitId}/shadow-summary` : null,
  );

  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  async function submit() {
    if (workUnitId == null || !date) return;
    const parsed = parseOptionalMinutes(minutes);
    if (parsed === "invalid") {
      setError(`Minutes must be ${MIN_DURATION_MINUTES}–${MAX_DURATION_MINUTES}, or left blank.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    setLimitReached(false);
    try {
      const body =
        parsed == null
          ? { occurred_at: dateToOccurredAt(date) }
          : { occurred_at: dateToOccurredAt(date), duration_minutes: parsed };
      await createShadowLog(workUnitId, body);
      setDate("");
      setMinutes("");
      logsApi.reload();
      summaryApi.reload();
    } catch (err) {
      if (err instanceof NeedsApiKeyError) setNeedsKey(true);
      else if (isFiveLimitError(err)) setLimitReached(true);
      else if (err instanceof ApiError && err.status === 409) {
        setError("That date is already logged.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="shadow-times">
      <h3 style={{ marginTop: 0 }}>
        Finish times{" "}
        <InfoTooltip term={TIMES_INFO.term} simple={TIMES_INFO.simple} technical={TIMES_INFO.technical} />
      </h3>
      {isGuest ? (
        <p className="hint" style={{ marginBottom: 0 }} data-testid="shadow-times-guest">
          {GUEST_TIMES_EMPTY}
        </p>
      ) : !ready || firstLoadPending ? (
        <p className="hint">Loading finish times…</p>
      ) : workUnitId == null ? (
        <p className="hint" style={{ marginBottom: 0 }} data-testid="shadow-times-no-unit">
          {NO_UNIT_YET}{" "}
          <Link to={evidencePackHref}>Import the evidence pack →</Link>
        </p>
      ) : logsApi.loading || summaryApi.loading ? (
        <p className="hint">Loading finish times…</p>
      ) : logsApi.error || summaryApi.error ? (
        <div className="banner error">{logsApi.error || summaryApi.error}</div>
      ) : (
        <KeyedTimes
          logs={logsApi.data ?? []}
          summary={summaryApi.data}
          date={date}
          minutes={minutes}
          submitting={submitting}
          needsKey={needsKey}
          error={error}
          limitReached={limitReached}
          onDate={setDate}
          onMinutes={setMinutes}
          onSaved={() => setNeedsKey(false)}
          onSubmit={() => void submit()}
        />
      )}
    </div>
  );
}

function KeyedTimes({
  logs,
  summary,
  date,
  minutes,
  submitting,
  needsKey,
  error,
  limitReached,
  onDate,
  onMinutes,
  onSaved,
  onSubmit,
}: {
  logs: ShadowLog[];
  summary: ShadowSummary | null;
  date: string;
  minutes: string;
  submitting: boolean;
  needsKey: boolean;
  error: string | null;
  limitReached: boolean;
  onDate: (value: string) => void;
  onMinutes: (value: string) => void;
  onSaved: () => void;
  onSubmit: () => void;
}) {
  const lastFive = (summary?.last_five ?? logs).slice(0, 5);
  const atCap = (summary?.count ?? logs.length) >= 5 || limitReached;
  return (
    <>
      <p className="hint" style={{ marginTop: 0 }} data-testid="shadow-times-label">
        {TIMES_LABEL}
      </p>
      <p style={{ fontSize: 15, margin: "0 0 12px" }} data-testid="shadow-times-sum">
        {selfReportedMinutesLine(summary?.duration_minutes_sum)}
      </p>
      {lastFive.length === 0 ? (
        <p className="hint" data-testid="shadow-times-empty">
          {NO_TIMES_YET}
        </p>
      ) : (
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }} data-testid="shadow-times-list">
          {lastFive.map((row) => (
            <li key={row.id} data-testid="shadow-times-row">
              {formatFinishDate(row.occurred_at)}
              {row.duration_minutes != null ? ` · ${row.duration_minutes} minutes` : ""}
            </li>
          ))}
        </ul>
      )}
      {needsKey && <ApiKeyBanner onSaved={onSaved} />}
      {error && <div className="banner error">{error}</div>}
      {atCap && (
        <p className="hint" style={{ marginTop: 0 }} data-testid="shadow-times-limit">
          {FIVE_IS_THE_LIMIT}
        </p>
      )}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => onDate(e.target.value)}
            aria-label="Finish time — date"
            data-testid="shadow-times-date"
          />
        </label>
        <label>
          Minutes (optional)
          <input
            type="number"
            min={MIN_DURATION_MINUTES}
            max={MAX_DURATION_MINUTES}
            value={minutes}
            onChange={(e) => onMinutes(e.target.value)}
            placeholder="1–480"
            aria-label="Finish time — minutes"
            data-testid="shadow-times-minutes"
          />
        </label>
        <button
          type="button"
          disabled={submitting || !date}
          onClick={onSubmit}
          data-testid="shadow-times-submit"
        >
          {submitting ? "Saving…" : "Add time"}
        </button>
      </div>
    </>
  );
}
