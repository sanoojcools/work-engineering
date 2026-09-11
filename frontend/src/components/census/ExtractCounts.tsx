import { useApi } from "../../hooks";
import { useCompany } from "../../company";
import { useIsGuest } from "../../lib/guestMode";
import { InfoTooltip } from "../InfoTooltip";
import { EXTRACT_COUNT_ROWS, GUEST_COUNTS_HINT, ZERO_COUNTS } from "../../lib/extractCounts";
import type { DelinquencyOut } from "../../types";

/** Four counts on Census Capture — not a seventh census step.
 * Guest never calls GET /scout/delinquency and never mints a key. */
export function ExtractCounts() {
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();
  const skip = isGuest || firstLoadPending;
  const { data, loading, error } = useApi<DelinquencyOut>(skip ? null : "/scout/delinquency");
  const waiting = firstLoadPending || (!isGuest && loading);
  const counts = isGuest ? ZERO_COUNTS : (data ?? ZERO_COUNTS);

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="extract-counts">
      <h3 style={{ marginTop: 0 }}>
        Four counts{" "}
        <InfoTooltip
          term="delinquency"
          simple="Four counts of how the notes were read: invented, left out, twisted, flattered. Empty is zeros — looking does not invent a score."
          technical="GET /api/scout/delinquency. invention / omission / distortion / flattery on this tenant. Guest never calls this. Looking does not POST commit=true."
        />
      </h3>
      {isGuest && !firstLoadPending ? (
        <>
          <CountTiles counts={ZERO_COUNTS} />
          <p className="hint" data-testid="extract-counts-guest" style={{ marginBottom: 0 }}>
            {GUEST_COUNTS_HINT}
          </p>
        </>
      ) : waiting ? (
        <p className="hint">Loading this tenant's four counts…</p>
      ) : error ? (
        <div className="banner error">{error}</div>
      ) : (
        <CountTiles counts={counts} />
      )}
    </div>
  );
}

function CountTiles({ counts }: { counts: DelinquencyOut }) {
  return (
    <div className="split" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
      {EXTRACT_COUNT_ROWS.map((row) => (
        <div key={row.key} className="card" style={{ margin: 0 }} data-testid={row.testId}>
          <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>
            {row.label}
            {row.key === "invention" && (
              <>
                {" "}
                <InfoTooltip
                  term="invention"
                  simple="A name that was not in the sitting. Looking does not add one to look complete."
                  technical="GET /api/scout/delinquency · invention. A span that is not a substring of the transcript is dropped and counted."
                />
              </>
            )}
          </div>
          <p style={{ fontSize: 28, margin: "4px 0" }} data-testid={`${row.testId}-value`}>
            {counts[row.key]}
          </p>
        </div>
      ))}
    </div>
  );
}
