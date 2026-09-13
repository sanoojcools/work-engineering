import { useApi } from "../../hooks";
import { useCompany } from "../../company";
import { useIsGuest } from "../../lib/guestMode";
import { ASK_THIS_EXACT, FACILITATOR_INFO, GUEST_FACILITATOR_EMPTY } from "../../lib/nextQuestions";
import type { NextQuestion } from "../../types";
import { InfoTooltip } from "../InfoTooltip";

/** Facilitator strip on the three-seat interview — not a seventh census step.
 * Keyed: GET /api/scout/sessions/{id}/next-questions, pack `text` verbatim.
 * Guest: empty line, never that API, never a key. [] → no strip. */
export function FacilitatorStrip({ sessionId }: { sessionId: number | null }) {
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();
  const skip = isGuest || firstLoadPending || sessionId == null;
  const { data, loading, error } = useApi<NextQuestion[]>(
    skip ? null : `/scout/sessions/${sessionId}/next-questions`,
  );

  if (firstLoadPending) return null;

  if (isGuest) {
    return (
      <div className="card" style={{ marginBottom: 16 }} data-testid="facilitator">
        <h3 style={{ marginTop: 0 }}>
          Facilitator{" "}
          <InfoTooltip
            term={FACILITATOR_INFO.term}
            simple={FACILITATOR_INFO.simple}
            technical={FACILITATOR_INFO.technical}
          />
        </h3>
        <p className="hint" style={{ marginBottom: 0 }} data-testid="facilitator-guest">
          {GUEST_FACILITATOR_EMPTY}
        </p>
      </div>
    );
  }

  if (sessionId == null || loading) return null;
  if (error || !data || data.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="facilitator">
      <h3 style={{ marginTop: 0 }}>
        Facilitator{" "}
        <InfoTooltip
          term={FACILITATOR_INFO.term}
          simple={FACILITATOR_INFO.simple}
          technical={FACILITATOR_INFO.technical}
        />
      </h3>
      <div className="stack" style={{ gap: 12 }}>
        {data.map((q) => (
          <div key={`${q.piece_code}-${q.field}-${q.pack_id}`} data-testid="facilitator-ask">
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
              {ASK_THIS_EXACT}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "4px 0 0" }} data-testid="facilitator-question">
              {q.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
