import { InfoTooltip } from "../InfoTooltip";

/** Customer-facing headings for every /census/* screen, Chart, and Plan.
 * Coined canon (Work Unit, VERDICT, provenance, verification, S1/S2/S3)
 * lives only in the i-buttons. Not a table. */
const HEADINGS: {
  label: string;
  term: string;
  simple: string;
  technical: string;
}[] = [
  {
    label: "Piece of work",
    term: "Work Unit",
    simple: "One small piece of work with a clear start and finish.",
    technical: "Work Unit — 18 contract attributes including authority, acceptance, evidence, verification.",
  },
  {
    label: "How sure we are",
    term: "VERDICT",
    simple: "How confident this record is, from the checks that already exist — not a new score invented for this screen.",
    technical: "VERDICT (7 questions) plus the careful / as calculated / ambitious replay of S1 / S2 / S3.",
  },
  {
    label: "How we know it",
    term: "Provenance",
    simple: "Where this claim came from — a file, a sitting, or a reconstruction. Empty means we do not know yet.",
    technical: "GET /work-units/{id}/pointers — file + cell/page/line after the resolver ran. Unopened pointers are not facts. Five statuses in plain words on Evidence.",
  },
  {
    label: "Checked by",
    term: "Verification",
    simple: "Who or what is supposed to check this piece, when that is stated. 'Not stated' means no check is recorded yet — not a pass.",
    technical: "GET /work-units/{id}/verification-design · method. Guest rows stay not stated.",
  },
  {
    label: "Independent?",
    term: "Independence",
    simple: "Whether the check is independent of the person who did the work. Not stated until someone records it.",
    technical: "GET /work-units/{id}/verification-design · independent. Offer-release and dual-employment pieces need independence ≠ no before handoff is ready.",
  },
  {
    label: "Careful / as calculated / ambitious",
    term: "S1 / S2 / S3",
    simple: "Three ways to read the same score: careful is the floor, as calculated is what VERDICT derived, ambitious is the ceiling. Appetite does not lift a stop.",
    technical: "S1 floor / S2 derived / S3 ceiling — the same scenarioStrip() Document check already uses. No second scoring engine.",
  },
];

export function CensusCustomerHeadings() {
  return (
    <div className="census-copy-headings" data-testid="census-copy-headings">
      {HEADINGS.map((h) => (
        <div key={h.label} className="census-copy-item">
          <span className="census-copy-label">
            {h.label}{" "}
            <InfoTooltip term={h.term} simple={h.simple} technical={h.technical} />
          </span>
        </div>
      ))}
    </div>
  );
}
