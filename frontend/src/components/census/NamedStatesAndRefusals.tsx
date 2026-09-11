import { useApi } from "../../hooks";
import { useCompany } from "../../company";
import { useIsGuest } from "../../lib/guestMode";
import { InfoTooltip } from "../InfoTooltip";
import { OFFER_TO_ONBOARDING_CODE } from "../../lib/workSystem";
import {
  GUEST_STATES_EMPTY,
  KEYED_STATES_EMPTY,
  REFUSALS_EMPTY,
  refusalReasonLabel,
  stateKindLabel,
} from "../../lib/journeyStates";
import type { AdmissibilityOut, ObjectStatesOut, Page, WorkSystem } from "../../types";

function ObjectStatesBlock({
  title,
  data,
  testId,
}: {
  title: string;
  data: ObjectStatesOut | null;
  testId: string;
}) {
  const states = data?.states ?? [];
  const empty = data?.empty ?? states.length === 0;
  return (
    <div data-testid={testId} style={{ marginBottom: 12 }}>
      <h4 style={{ margin: "0 0 6px" }}>{title}</h4>
      {empty ? (
        <p className="hint" style={{ marginBottom: 0 }} data-testid={`${testId}-empty`}>
          {KEYED_STATES_EMPTY}
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {states.map((s) => (
            <li key={`${s.kind}-${s.name}`} data-testid={`${testId}-row`}>
              {s.name} — {stateKindLabel(s.kind)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Named before/after for Offer and Employee, plus this journey's refusals.
 * Gap step 4 — not a seventh census step. Guest never calls the APIs. */
export function NamedStatesAndRefusals() {
  const isGuest = useIsGuest();
  const { firstLoadPending } = useCompany();
  const skip = isGuest || firstLoadPending;

  const offer = useApi<ObjectStatesOut>(skip ? null : "/objects/offer/states");
  const employee = useApi<ObjectStatesOut>(skip ? null : "/objects/employee/states");
  const systems = useApi<Page<WorkSystem>>(skip ? null : "/work-systems");
  const journeyId =
    systems.data?.items.find((row) => row.code === OFFER_TO_ONBOARDING_CODE)?.id ?? null;
  const admiss = useApi<AdmissibilityOut>(
    skip || journeyId == null ? null : `/work-systems/${journeyId}/admissibility`,
  );

  const statesWaiting = firstLoadPending || (!isGuest && (offer.loading || employee.loading));
  const statesError = offer.error || employee.error;
  const refusalsWaiting =
    firstLoadPending || (!isGuest && (systems.loading || (journeyId != null && admiss.loading)));
  const refusalsError = systems.error || admiss.error;
  const refusals = admiss.data?.refusals ?? [];

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }} data-testid="named-states">
        <h3 style={{ marginTop: 0 }}>
          Named before and after{" "}
          <InfoTooltip
            term="named before and after"
            simple="What must be true before a piece of work can start, and what must be true when it is finished. Empty means nobody has named them yet — looking does not invent a list."
            technical="GET /api/objects/offer/states and GET /api/objects/employee/states. kind=before | after | both from this tenant's work_units.current_condition / desired_condition. Guest never calls these."
          />
        </h3>
        {isGuest && !firstLoadPending ? (
          <p className="hint" data-testid="named-states-guest" style={{ marginBottom: 0 }}>
            {GUEST_STATES_EMPTY}
          </p>
        ) : statesWaiting ? (
          <p className="hint">Loading this tenant's named before and after…</p>
        ) : statesError ? (
          <div className="banner error">{statesError}</div>
        ) : (
          <>
            <ObjectStatesBlock title="Offer" data={offer.data} testId="named-states-offer" />
            <ObjectStatesBlock title="Employee" data={employee.data} testId="named-states-employee" />
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }} data-testid="journey-refusals">
        <h3 style={{ marginTop: 0 }}>
          This journey's refusals{" "}
          <InfoTooltip
            term="admissibility"
            simple="A piece on this journey is refused when it has no finish we can observe, names two owners, or asks for a check with no hours we will defend. Empty is none yet — not a fake fail."
            technical="GET /api/work-systems/{id}/admissibility. reason=no_exit | two_owners | unaffordable_check. Scores Offer Desk → Onboarding units only. Guest never calls this."
          />
        </h3>
        {isGuest && !firstLoadPending ? (
          <p className="hint" data-testid="journey-refusals-empty" style={{ marginBottom: 0 }}>
            {REFUSALS_EMPTY}
          </p>
        ) : refusalsWaiting ? (
          <p className="hint">Loading this journey's refusals…</p>
        ) : refusalsError ? (
          <div className="banner error">{refusalsError}</div>
        ) : refusals.length === 0 ? (
          <p className="hint" data-testid="journey-refusals-empty" style={{ marginBottom: 0 }}>
            {REFUSALS_EMPTY}
          </p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Piece of work</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {refusals.map((row) => (
                  <tr key={`${row.work_unit_id}-${row.reason}`} data-testid={`journey-refusal-${row.code}`}>
                    <td>
                      <code style={{ fontSize: 12 }}>{row.code}</code>
                    </td>
                    <td data-testid={`journey-refusal-reason-${row.code}`}>{refusalReasonLabel(row.reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
