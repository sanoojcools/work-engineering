import { Link } from "react-router-dom";
import { InfoTooltip } from "../InfoTooltip";
import {
  HIRE_BANDS,
  HIRE_BAND_HINT,
  HIRE_BAND_LABEL,
  HIRE_COMPOSITE,
  PARENT_HOURS_NOTE,
  buildHireLeafRows,
  type HireBand,
} from "../../lib/hireLeaves";
import {
  FIRES_CUSTOMER,
  GUEST_CAPACITY,
  type ChartScenario,
} from "../../lib/offerDay1Simulation";
import type { ScenarioStrip } from "../../lib/offerDeskScenarios";
import type { SimulationFires, Verdict, WorkUnit } from "../../types";

function levelBadge(strip: ScenarioStrip, scenario: ChartScenario): string {
  if (!strip.scored) return "not scored";
  const point = scenario === "careful" ? strip.s1Floor : scenario === "ambitious" ? strip.s3Ceiling : strip.s2Derived;
  return `L${point.level} · ${point.allocation}`;
}

function BandColumn({
  band,
  rows,
  scenario,
  firesById,
}: {
  band: HireBand;
  rows: ReturnType<typeof buildHireLeafRows>;
  scenario: ChartScenario;
  firesById: Record<string, SimulationFires>;
}) {
  const inBand = rows.filter((r) => r.leaf.band === band);
  return (
    <section className="card hire-band" data-testid={`hire-band-${band}`}>
      <h4 style={{ margin: "0 0 4px" }}>
        {HIRE_BAND_LABEL[band]}{" "}
        <InfoTooltip
          term={band}
          simple={HIRE_BAND_HINT[band]}
          technical={`Canon band: ${band}. Declared from packs/hr/hire_leaves.yaml, not a live connector.`}
        />
      </h4>
      <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        {inBand.length} piece{inBand.length === 1 ? "" : "s"}
      </p>
      <ul className="hire-leaf-list">
        {inBand.map((row) => {
          const fires = firesById[row.leaf.id] ?? "no";
          return (
            <li key={row.leaf.id}>
              <Link to={row.clickTo} className="hire-leaf" data-testid="hire-leaf" data-leaf-id={row.leaf.id}>
                <code style={{ fontSize: 11 }}>{row.displayCode}</code>
                <strong>{row.leaf.name}</strong>
                <span
                  className={fires === "blocked" ? "badge bad" : "hint"}
                  data-testid="hire-leaf-fires"
                  data-fires={fires}
                  style={{ marginTop: 4 }}
                >
                  {FIRES_CUSTOMER[fires]}
                </span>
                <span className="hint">Checked by: {row.checkedBy}</span>
                <span className="hint">How sure we are: {levelBadge(row.strip, scenario)}</span>
                <span className="hint">How we know it: {row.howWeKnow}</span>
                {row.leaf.stop === "dual_employment" && (
                  <span className="badge bad" style={{ marginTop: 4 }}>
                    Stop — dual employment
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 18-leaf Work Chart: four bands including external, composite “the hire is complete”.
 * Each leaf names fires / outside / human must touch / blocked. Capacity is
 * not live — 95 stated / 61.8 defended as two numbers, never on a leaf. */
export function HireLeavesChart({
  units,
  verdicts,
  scenario,
  firesById,
  capacity,
}: {
  units: WorkUnit[];
  verdicts: Verdict[];
  scenario: ChartScenario;
  firesById: Record<string, SimulationFires>;
  capacity?: { labelled: string; stated_hours_mo: number; defended_hours_mo: number };
}) {
  const rows = buildHireLeafRows(units, verdicts);
  const cap = capacity ?? GUEST_CAPACITY;
  return (
    <div data-testid="hire-leaves">
      <h3 style={{ marginBottom: 4 }}>
        {HIRE_COMPOSITE.name}{" "}
        <InfoTooltip
          term="Composite"
          simple="The hire is complete when these 18 pieces are done — including the ones that sit outside this desk. Not a 19th piece."
          technical="HIRE-COMPLETE in packs/hr/hire_leaves.yaml. Frontend seed this slice; not a persisted Work Unit unless a later slice writes one."
        />
      </h3>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        18 pieces of work, from the declared seed. Four bands, including work outside this desk. Names on this
        chart are stand-ins, not a live sitting.
      </p>
      <div className="hire-bands">
        {HIRE_BANDS.map((band) => (
          <BandColumn key={band} band={band} rows={rows} scenario={scenario} firesById={firesById} />
        ))}
      </div>
      <div className="card" style={{ marginBottom: 12 }} data-testid="chart-capacity">
        <h4 style={{ margin: "0 0 4px" }}>
          Capacity — not live{" "}
          <InfoTooltip
            term="simulator"
            simple="How many people this would take if we ran it — not live. The two numbers are the same as Plan: 95 stated and 61.8 defended. They are not printed on a piece of work."
            technical="GET /api/simulations/offer-day1 · capacity.labelled=not_live. stated_hours_mo=95, defended_hours_mo=61.8. Guest never calls this. Not Box 6, not Box 4."
          />
        </h4>
        <div className="split" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
          <div>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Stated</div>
            <p style={{ fontSize: 28, margin: "4px 0" }} data-testid="chart-capacity-stated">
              {cap.stated_hours_mo}
            </p>
          </div>
          <div>
            <div className="hint" style={{ marginTop: 0, fontWeight: 700 }}>Defended</div>
            <p style={{ fontSize: 28, margin: "4px 0" }} data-testid="chart-capacity-defended">
              {cap.defended_hours_mo}
            </p>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Same two numbers as Plan. Not a live headcount. Not printed on a piece of work.
        </p>
      </div>
      <p className="hint" data-testid="hire-hours-note" style={{ marginTop: 0, marginBottom: 16 }}>
        {PARENT_HOURS_NOTE}
      </p>
    </div>
  );
}
