import { Link } from "react-router-dom";
import { InfoTooltip } from "./InfoTooltip";
import { IoPanes } from "./IoPanes";
import type { DeskSpec } from "../lib/desks/types";

/** Thin desk-walk (HR-FAMILY v0, task E): one shared page shape for every
 * new desk instead of a 12-tab Offer Desk clone per desk. Overview + step
 * list + SPOC + hours from sheet + a link to the function graph -- five
 * things, not eleven pages. Offer Desk itself keeps its own existing,
 * untouched page (OfferDesk.tsx); this component is never used for it. */
export function DeskWalk({ spec }: { spec: DeskSpec }) {
  const finalized = spec.status === "finalized";
  return (
    <>
      <p className="hint" style={{ marginBottom: 4 }}>
        {spec.category}
      </p>
      <h2>
        {spec.name}{" "}
        <span
          className={`banner ${finalized ? "ok" : "warn"}`}
          style={{ display: "inline-block", padding: "2px 8px", fontSize: 12, verticalAlign: "middle" }}
        >
          {finalized ? "Finalized sitting" : "Needs follow-up"}
        </span>{" "}
        <InfoTooltip
          term="Sitting status"
          simple={
            finalized
              ? "Trianz's own Time & Motion Study calls this workflow's documentation finalized."
              : "Trianz's own Time & Motion Study says this was 'covered through sessions' but still needs post follow-up documentation and validation — Trianz's words, not this repo's guess."
          }
          technical={`Source: ${spec.sourceFile} (desks/README.md carries the founder's own email establishing this per-desk).`}
        />
      </h2>
      <p className="lede">{spec.outcome}</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Overview</h3>
        <dl className="story-fields graph-detail-grid">
          <dt>Workflow</dt>
          <dd>{spec.workflowName}</dd>

          <dt>Trigger</dt>
          <dd>{spec.trigger}</dd>

          <dt>Frequency</dt>
          <dd>{spec.frequency}</dd>

          <dt>
            SPOC{" "}
            <InfoTooltip term="SPOC" simple="The single point of contact who actually runs this desk, named in the sitting." />
          </dt>
          <dd>{spec.primarySpoc}</dd>

          {spec.backup && (
            <>
              <dt>Backup</dt>
              <dd>{spec.backup}</dd>
            </>
          )}

          <dt>Systems</dt>
          <dd>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {spec.systems.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </dd>

          <dt>Interview source</dt>
          <dd>{spec.interviewSource}</dd>

          <dt>Original sheet</dt>
          <dd>
            <code>{spec.sourceFile}</code> — read-only original, kept as-is
          </dd>
        </dl>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Step list{" "}
          <InfoTooltip
            term="Step list"
            simple="Every step verbatim from the sitting's own micro-steps table — what happens, on what system, by whom, how long, how often."
          />
        </h3>
        <div className="stack" style={{ gap: 10 }}>
          {spec.steps.map((step) => (
            <div className="card" key={step.id} style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong>
                  {step.id}. {step.name}
                </strong>
                <span className="hint">
                  {step.system} · {step.spoc}
                </span>
              </div>
              <p style={{ fontSize: 13, margin: "6px 0" }}>{step.whatHappens}</p>
              <p className="hint" style={{ margin: 0 }}>
                {step.timePerCase} · {step.volumePerMonth} · {step.automationTag}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Hours{" "}
          <InfoTooltip
            term="Hours"
            simple="Declared only — the sitting's own effort profile and its own savings claim. Not a defended, costed number like Offer Desk's 61.8 (that took four costing disciplines this slice did not repeat here)."
          />
        </h3>
        <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13 }}>
          {spec.monthlyEffortProfile.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p style={{ fontSize: 13, margin: 0 }}>
          <strong>Declared total:</strong> {spec.totalEstimatedSavings}
        </p>
      </div>

      <IoPanes
        given={`${spec.sourceFile}, the sitting's own micro-steps table.`}
        understood={
          finalized
            ? "This workflow's documentation is finalized per the founder's own email — the steps below are the sitting's own words, not this repo's paraphrase."
            : "This workflow was 'covered through sessions' but still needs post follow-up documentation and validation, per the founder's own email — shown as-is, not smoothed into looking more finished than it is."
        }
        processed="Parsed once into a shared DeskSpec — the same shape Offer Desk's own step list generalizes into — so this page did not need its own bespoke layout."
        output={`${spec.steps.length} step(s), ${spec.handoffs.length} handoff row(s) on the sitting's own handoff map (see the function graph for the cross-desk ones).`}
      />

      <p style={{ marginTop: 20 }}>
        <Link to="/hr/function-graph">See how {spec.name} hands off to other desks →</Link>
      </p>
    </>
  );
}
