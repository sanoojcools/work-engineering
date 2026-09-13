import { InfoTooltip } from "../InfoTooltip";
import { useApi } from "../../hooks";
import { useCompany } from "../../company";
import { useIsGuest } from "../../lib/guestMode";
import { withClient } from "../../lib/withClient";
import {
  GUEST_RISKS_EMPTY,
  KEYED_RISKS_EMPTY,
  admissibilityFrom,
  translatePlanRisks,
} from "../../lib/planRisks";
import type { AdmissibilityOut, Gap, GraphProjection, Page, WorkSystem, WorkUnit } from "../../types";

/** CHRO block on Plan. Guest never calls the APIs and never mints a key. */
export function PlanRisks({
  units,
  workSystem,
}: {
  units: WorkUnit[];
  workSystem: WorkSystem | null;
}) {
  const isGuest = useIsGuest();
  const { keyClientId, firstLoadPending } = useCompany();
  const skip = isGuest || firstLoadPending;
  const gapsApi = useApi<Page<Gap>>(skip ? null : withClient("/discovery/gaps", keyClientId));
  const graphApi = useApi<GraphProjection>(skip ? null : withClient("/projections/work-graph", keyClientId));
  const admissApi = useApi<AdmissibilityOut>(
    skip || !workSystem ? null : `/work-systems/${workSystem.id}/admissibility`,
  );

  const waiting =
    !isGuest &&
    (firstLoadPending || gapsApi.loading || graphApi.loading || (workSystem != null && admissApi.loading));
  const risks = isGuest
    ? []
    : translatePlanRisks({
        units,
        gaps: gapsApi.data?.items,
        refusals: admissibilityFrom(admissApi.data),
        graph: graphApi.data,
      });

  return (
    <div className="card" style={{ marginBottom: 16 }} data-testid="plan-risks">
      <h3 style={{ marginTop: 0 }}>
        What can go wrong{" "}
        <InfoTooltip
          term="What can go wrong"
          simple="Only conditions this walk already computed: a loop, two owners, no finish, an empty decision or done-rule, or the dual-employment stop. Empty means none yet. We do not invent a scare list."
          technical="Mapped from this tenant's work units, GET /discovery/gaps (split_recommended, missing_terminal_state), GET /work-systems/{id}/admissibility (two_owners, no_exit), and sequence edges on GET /projections/work-graph. Guest never calls these. Canon: cycle, Work Unit. Never maps GQS fail, talk-only, or undeclared to a risk."
        />
      </h3>
      {isGuest ? (
        <p className="hint" style={{ marginBottom: 0 }} data-testid="plan-risks-empty">
          {GUEST_RISKS_EMPTY}
        </p>
      ) : waiting ? (
        <p className="hint">Reading what this tenant already named…</p>
      ) : risks.length === 0 ? (
        <p className="hint" style={{ marginBottom: 0 }} data-testid="plan-risks-empty">
          {KEYED_RISKS_EMPTY}
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} data-testid="plan-risks-list">
          {risks.map((risk) => (
            <li key={risk.id} data-testid="plan-risk-row" data-risk-kind={risk.kind}>
              {risk.sentence}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
