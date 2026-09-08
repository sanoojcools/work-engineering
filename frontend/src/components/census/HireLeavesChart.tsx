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
import type { ScenarioStrip } from "../../lib/offerDeskScenarios";
import type { Verdict, WorkUnit } from "../../types";

type ScenarioKey = "careful" | "as-calculated" | "ambitious";

function levelBadge(strip: ScenarioStrip, scenario: ScenarioKey): string {
  if (!strip.scored) return "not scored";
  const point = scenario === "careful" ? strip.s1Floor : scenario === "ambitious" ? strip.s3Ceiling : strip.s2Derived;
  return `L${point.level} · ${point.allocation}`;
}

function BandColumn({
  band,
  rows,
  scenario,
}: {
  band: HireBand;
  rows: ReturnType<typeof buildHireLeafRows>;
  scenario: ScenarioKey;
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
        {inBand.map((row) => (
          <li key={row.leaf.id}>
            <Link to={row.clickTo} className="hire-leaf" data-testid="hire-leaf" data-leaf-id={row.leaf.id}>
              <code style={{ fontSize: 11 }}>{row.displayCode}</code>
              <strong>{row.leaf.name}</strong>
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
        ))}
      </ul>
    </section>
  );
}

/** 18-leaf Work Chart: four bands including external, composite “the hire is complete”. */
export function HireLeavesChart({
  units,
  verdicts,
  scenario,
}: {
  units: WorkUnit[];
  verdicts: Verdict[];
  scenario: ScenarioKey;
}) {
  const rows = buildHireLeafRows(units, verdicts);
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
          <BandColumn key={band} band={band} rows={rows} scenario={scenario} />
        ))}
      </div>
      <p className="hint" data-testid="hire-hours-note" style={{ marginTop: 0, marginBottom: 16 }}>
        {PARENT_HOURS_NOTE}
      </p>
    </div>
  );
}
