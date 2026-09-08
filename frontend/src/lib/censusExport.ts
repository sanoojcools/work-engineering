/** P1 -- Census export (docs/BUILD_PROGRAM.md CENSUS-PACK): "Download
 * census" on Plan (and the census shell) -> one markdown file, live state
 * only. Every section below reads an existing module or a real fetched
 * row -- nothing here is a new arithmetic or a second store. Guest gets the
 * same declared-schematic every census screen already shows a guest;
 * keyed gathers this tenant's real rows through the same endpoints Evidence
 * / Gap / Work Chart / Plan already call.
 *
 * No invented numbers: where a live figure doesn't exist for this build
 * (the family genome's own GQS score is never persisted anywhere this
 * export could read it back from), this quotes the same qualitative,
 * structural sentence Plan already states on-screen, not a fabricated
 * number dressed as a live read. */
import { apiFetch } from "./apiFetch";
import { withClient } from "./withClient";
import { DESKS_BY_ID } from "./desks";
import { LANE_DESK_IDS, buildRows } from "./workSystemUnits";
import { HIRE_BANDS, HIRE_BAND_LABEL, HIRE_COMPOSITE, PARENT_HOURS_NOTE, buildHireLeafRows } from "./hireLeaves";
import { DOCUMENT_CHECK_RECORD, GAP_ROWS } from "./offerDeskWorkRecord";
import { GUEST_REGISTER_COUNTS, REGISTERS, REGISTER_COPY, countRegisters } from "./gapRegisters";
import { CANNOT_SEE_CONNECTOR_NOTE, CANNOT_SEE_JUDGMENT_NOTE, GATE_KINDS, isGateKind, KIND_COPY } from "./gapGateKinds";
import { unitReadiness } from "./handoffReadiness";
import { ensureOfferToOnboardingWorkSystem, GUEST_JOURNEY } from "./workSystem";
import type { Gap, Page, UploadedFileOut, Verdict, WorkSystem, WorkUnit } from "../types";

// Reused verbatim by CensusPlan.tsx's own "Quality gate reminder" card, so
// the on-screen sentence and the exported one never drift apart.
export const GQS_REMINDER_PRE =
  "The family genome (all six desks, declared) is expected to fail GQS — around 30 of the 90-point gate, " +
  "because Observed% is structurally 0 with no system-of-record connector behind it.";
export const GQS_REMINDER_BOLD = "~30/90 is not a pass.";
export const GQS_REMINDER_POST =
  "Planning against it as if it were governed would misrepresent what the gate actually found.";

// Known filenames from the one fabricated sample pack this build ships
// (lib/offerDeskEvidencePack.json's own `files` array) -- checked against a
// tenant's real file list so the banner's "fabricated pack" line only
// appears when that pack is actually the source of what's being exported,
// not printed unconditionally.
const SAMPLE_PACK_FILENAMES = new Set([
  "zwayam-candidate-export.csv",
  "zoho-signing-log.csv",
  "uan-service-history-sample.csv",
  "onedrive-placement-log.csv",
  "master-joining-sheet.xlsx",
  "email-id-creation-tracker.xlsx",
  "payroll-report-17th.xlsx",
]);

export type CensusExportInput =
  | { mode: "guest" }
  | {
      mode: "keyed";
      tenantName: string | null;
      journey: WorkSystem;
      units: WorkUnit[];
      verdicts: Verdict[];
      gaps: Gap[];
      files: UploadedFileOut[];
    };

/** On-demand gather -- called from a click handler, not eagerly loaded by
 * every census screen. Guest never issues a request. */
export async function gatherCensusExportInput(
  isGuest: boolean,
  keyClientId: number | null,
  tenantName: string | null,
): Promise<CensusExportInput> {
  if (isGuest) return { mode: "guest" };

  const unitsPath = withClient("/work-units/", keyClientId) ?? "/work-units/";
  const verdictsPath = withClient("/verdict/", keyClientId) ?? "/verdict/";
  const gapsPath = withClient("/discovery/gaps", keyClientId) ?? "/discovery/gaps";

  const [journey, unitsPage, verdictsPage, gapsPage, filesPage] = await Promise.all([
    ensureOfferToOnboardingWorkSystem(),
    apiFetch.get<Page<WorkUnit>>(unitsPath),
    apiFetch.get<Page<Verdict>>(verdictsPath),
    apiFetch.get<Page<Gap>>(gapsPath),
    apiFetch.get<Page<UploadedFileOut>>("/files"),
  ]);

  return {
    mode: "keyed",
    tenantName,
    journey,
    units: unitsPage.items,
    verdicts: verdictsPage.items,
    gaps: gapsPage.items,
    files: filesPage.items,
  };
}

function escapeCell(s: string): string {
  return s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function intentSection(title: string, intent: WorkSystem["function_intent"]): string {
  const confirmed = intent.status === "confirmed";
  const lines = [
    `**${title}** -- ${confirmed ? `confirmed by ${intent.confirmed_by} at ${intent.confirmed_at}` : "draft, unconfirmed"}`,
    `- Label: ${intent.label || "not drafted yet"}`,
    `- Owner: ${intent.owner || "not stated"}`,
  ];
  if (intent.measure !== null) lines.push(`- Measure: ${intent.measure || "not stated"}`);
  return lines.join("\n");
}

function scopeSection(journey: WorkSystem): string {
  return [
    `- **Journey:** ${journey.name}`,
    `- **Entry:** ${journey.entry}`,
    `- **Exit:** ${journey.exit}`,
    `- **Owner:** ${journey.owner}`,
    `- **Outcome:** ${journey.outcome}`,
    `- **Governance:** ${journey.status === "ratified" ? `ratified by ${journey.ratified_by} at ${journey.ratified_at}` : "candidate -- not yet ratified"}`,
  ].join("\n");
}

function evidenceSection(
  isGuest: boolean,
  files: UploadedFileOut[] | null,
  gaps: Gap[] | null,
): string {
  const counts = isGuest ? GUEST_REGISTER_COUNTS : countRegisters(gaps ?? []);
  const countLines = REGISTERS.map((r) => `- **${REGISTER_COPY[r].label}:** ${counts[r]}`);

  let filesBlock: string;
  if (isGuest) {
    filesBlock = "No files in this walk — a guest has no tenant to upload into.";
  } else if (!files || files.length === 0) {
    filesBlock = "No files uploaded yet for this tenant — a true empty state, not a placeholder.";
  } else {
    filesBlock = files
      .map((f) => {
        const backs = f.backs.length === 0
          ? "backs nothing yet"
          : f.backs.map((b) => `${b.work_unit_code} (${b.claim})`).join("; ");
        return `- \`${escapeCell(f.file_name)}\` (sha256 ${f.sha256.slice(0, 12)}…) -- ${escapeCell(backs)}`;
      })
      .join("\n");
  }

  return ["**Files:**", filesBlock, "", "**Registers (counts, not a coverage %):**", ...countLines].join("\n");
}

function gapSection(isGuest: boolean, gaps: Gap[] | null): string {
  const lines: string[] = [];
  if (isGuest) {
    lines.push("Guest — the same four illustrative declared-vs-sitting rows shown throughout this walk:");
    lines.push("");
    lines.push("| Topic | Declared | Sitting | Gap |");
    lines.push("|---|---|---|---|");
    for (const row of GAP_ROWS) {
      lines.push(`| ${escapeCell(row.topic)} | ${escapeCell(row.declared)} | ${escapeCell(row.sitting)} | ${escapeCell(row.gap)} |`);
    }
  } else {
    const realGaps = (gaps ?? []).filter((g) => isGateKind(g.kind));
    if (realGaps.length === 0) {
      lines.push(
        "Nothing flagged for this tenant — a true empty state, not a clean bill of health. No genome import has " +
          "tripped an undeclared / split-recommended / missing-terminal-state check yet.",
      );
    } else {
      lines.push("| Kind | Why | Reference |");
      lines.push("|---|---|---|");
      for (const g of realGaps) {
        const copy = KIND_COPY[g.kind as (typeof GATE_KINDS)[number]];
        lines.push(`| ${copy.label} [\`${g.kind}\`] | ${escapeCell(g.description)} | ${escapeCell(g.declared_ref || "—")} |`);
      }
    }
  }
  lines.push("");
  lines.push(`- ${CANNOT_SEE_CONNECTOR_NOTE}`);
  lines.push(`- ${CANNOT_SEE_JUDGMENT_NOTE}`);
  lines.push("");
  lines.push('Neither of the above is a percentage — no invented "coverage" number.');
  return lines.join("\n");
}

function chartSection(units: WorkUnit[], verdicts: Verdict[]): string {
  const rows = buildHireLeafRows(units, verdicts);
  const blocks: string[] = [
    `**Composite:** ${HIRE_COMPOSITE.name}`,
    "",
    "18 pieces of work. Four bands, including work outside this desk. Names below are stand-ins.",
    "",
  ];
  for (const band of HIRE_BANDS) {
    const inBand = rows.filter((r) => r.leaf.band === band);
    blocks.push(`**${HIRE_BAND_LABEL[band]}** (\`${band}\`)`);
    blocks.push("");
    blocks.push("| Code | Piece of work | Checked by | How sure we are | How we know it |");
    blocks.push("|---|---|---|---|---|");
    for (const row of inBand) {
      const sure = row.strip.scored
        ? `L${row.strip.s2Derived.level} ${row.strip.s2Derived.allocation}`
        : "not scored";
      blocks.push(
        `| \`${row.displayCode}\` | ${escapeCell(row.leaf.name)} | ${escapeCell(row.checkedBy)} | ${sure} | ${escapeCell(row.howWeKnow)} |`,
      );
    }
    blocks.push("");
  }
  blocks.push(PARENT_HOURS_NOTE);
  return blocks.join("\n").trim();
}

function planSection(): string {
  return [
    `- **Hours:** ${DOCUMENT_CHECK_RECORD.declaredHours} declared / ${DOCUMENT_CHECK_RECORD.defendedHours} defended (hrs/mo), Document check, after four costing disciplines.`,
    `- **Stop:** ${DOCUMENT_CHECK_RECORD.stopRule}`,
    `- **Quality gate:** ${GQS_REMINDER_PRE} ${GQS_REMINDER_BOLD} ${GQS_REMINDER_POST}`,
  ].join("\n");
}

function openQuestionsSection(
  isGuest: boolean,
  gaps: Gap[] | null,
  units: WorkUnit[],
  verdicts: Verdict[],
): string {
  const counts = isGuest ? GUEST_REGISTER_COUNTS : countRegisters(gaps ?? []);
  const repairLines = REGISTERS.filter((r) => counts[r] > 0).map((r) => `- **${REGISTER_COPY[r].label}:** ${REGISTER_COPY[r].repair}`);

  const handoffLines: string[] = [];
  if (isGuest) {
    handoffLines.push(
      "- Guest: handoff readiness needs a real record to check — nothing below is a real Work Unit, so nothing " +
        "here can honestly be marked ready.",
    );
  } else {
    for (const deskId of LANE_DESK_IDS) {
      const desk = DESKS_BY_ID[deskId];
      const rows = buildRows(deskId, desk, units, verdicts);
      for (const row of rows) {
        if (!row.matched) continue;
        const readiness = unitReadiness(row.matched, row.verdict);
        if (!readiness.ready) {
          handoffLines.push(`- \`${row.displayCode}\` (${escapeCell(row.name)}): ${readiness.reasons.join(" ")}`);
        }
      }
    }
    if (handoffLines.length === 0) {
      handoffLines.push("- No matched unit on this tenant is missing handoff completeness right now.");
    }
  }

  return [
    "**Repair list (from the registers above):**",
    repairLines.length > 0 ? repairLines.join("\n") : "- Nothing registered yet — no repair to list.",
    "",
    "**Not ready to hand off, and why (P2 -- see /census/plan):**",
    ...handoffLines,
  ].join("\n");
}

export function buildCensusMarkdown(input: CensusExportInput, generatedAt: Date = new Date()): string {
  const isGuest = input.mode === "guest";
  const journey = isGuest ? GUEST_JOURNEY : input.journey;
  const units = isGuest ? [] : input.units;
  const verdicts = isGuest ? [] : input.verdicts;
  const gaps = isGuest ? null : input.gaps;
  const files = isGuest ? null : input.files;

  const bannerLines: string[] = [];
  if (isGuest) {
    bannerLines.push(
      "> **Guest / talk-only.** This walk has no real tenant data — nothing below is a real evidence file, a " +
        "real VERDICT score, or a real Work Unit. Every line is the same declared-schematic shown to every " +
        "visitor of this walk, not one company's data.",
    );
  } else {
    const hasSamplePack = (files ?? []).some((f) => SAMPLE_PACK_FILENAMES.has(f.file_name));
    if (hasSamplePack) {
      bannerLines.push(
        '> **Sample evidence pack.** This tenant\'s files include the "With evidence (sample)" pack — that pack ' +
          "is fabricated on purpose for this build. It is not Rashmi KN's real production data, and not a real " +
          "Zwayam or Zoho connector.",
      );
    }
  }

  const sections = [
    `# Census — offer → Day-1 Work System`,
    `Generated ${generatedAt.toISOString()} · ${isGuest ? "guest (declared sitting)" : `keyed${input.mode === "keyed" && input.tenantName ? ` — ${input.tenantName}` : ""}`}`,
    bannerLines.length > 0 ? bannerLines.join("\n") : null,
    `## 1. Scope`,
    scopeSection(journey),
    `## 2. Intent`,
    [intentSection("Function intent — HR operations", journey.function_intent), intentSection("Work System intent — this journey", journey.work_system_intent)].join("\n\n"),
    `## 3. Evidence health`,
    evidenceSection(isGuest, files, gaps),
    `## 4. Gap`,
    gapSection(isGuest, gaps),
    `## 5. Chart snapshot`,
    chartSection(units, verdicts),
    `## 6. Plan`,
    planSection(),
    `## 7. Open questions / repair list`,
    openQuestionsSection(isGuest, gaps, units, verdicts),
  ];

  return sections.filter((s): s is string => s !== null).join("\n\n") + "\n";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function censusExportFilename(date: Date = new Date()): string {
  return `census-offer-day1-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}.md`;
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
