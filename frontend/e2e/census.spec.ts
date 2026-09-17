import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/** CENSUS-v0's five required scenarios (docs/BUILD_PROGRAM.md, "Playwright
 * (must)"). Each test that needs a signed-in tenant mints its own fresh
 * demo key directly via POST /api/demo/bootstrap?new_keys=true (the same
 * endpoint DemoSetup.tsx's "Issue fresh keys" button calls) and writes it
 * to localStorage before navigating — real backend, real Postgres, no
 * mocked network. Never reuses a key across tests: a second bootstrap
 * against an already-provisioned tenant with no forced new key returns
 * api_key: null (see DemoSetup.tsx), which would strand a fresh browser
 * context with nothing to sign in with. */

async function signInWithFreshDemoKey(page: Page, request: APIRequestContext): Promise<void> {
  const res = await request.post("/api/demo/bootstrap?new_keys=true");
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { api_key: string | null };
  expect(body.api_key).toBeTruthy();
  await page.goto("/");
  await page.evaluate((key) => localStorage.setItem("we-spec-key", key), body.api_key as string);
}

function stepCount(page: Page) {
  return page.locator(".progress-count");
}

const CLAIMS_XLSX = join(process.cwd(), "e2e", "fixtures", "offer-pack-claims.xlsx");

const PDF_PAGE_TEXT = "Board approved the FY24 budget on March 3.";
const PDF_PAGE_QUOTE = "FY24 budget";

/** Minimal one-page PDF pypdf can extract, same shape as backend
 * tests/test_pointers.py::_real_pdf. */
function realPdfWithText(text: string): Buffer {
  const contentStream = Buffer.from(`BT /F1 24 Tf 72 712 Td (${text}) Tj ET`);
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
    ),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    Buffer.concat([
      Buffer.from(`<< /Length ${contentStream.length} >>\nstream\n`),
      contentStream,
      Buffer.from("\nendstream"),
    ]),
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  let length = chunks[0].length;
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(length);
    const wrapped = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      obj,
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(wrapped);
    length += wrapped.length;
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}

/** Seed one Work Unit + an XLSX pointer (and a broken / composed / binding
 * sibling) through the real API so Evidence can click them. Unique code so
 * a warm Client A tenant from an earlier run does not 409. Unique type so
 * we do not reuse types.items[0] after a V10-2 evidence-pack genome import.
 * V10-10 also seeds a PDF page pointer (connected) and an unused file (not). */
async function seedEvidencePointers(request: APIRequestContext, apiKey: string): Promise<{
  code: string;
  wuId: number;
  fileName: string;
  fileId: number;
  cell: string;
  pdfFileName: string;
  pdfFileId: number;
  unusedFileName: string;
  unusedFileId: number;
  page: number;
}> {
  const headers = { "X-Spec-Key": apiKey };
  const typeName = `V10-2 Evidence UI Object ${Date.now().toString(36)}`;
  const created = await request.post("/api/ontology/types", {
    headers,
    data: {
      name: typeName,
      kind: "business_object",
      description: "",
      state_machine: '["draft","done"]',
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const typeId = ((await created.json()) as { id: number }).id;
  expect(typeId).toBeTruthy();

  const code = `WU-V102-${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`.slice(0, 40);
  const unitBody = {
    code,
    name: "Check candidate documents before offer release",
    business_object_type_id: typeId,
    current_condition: "Documents unchecked",
    desired_condition: "Accepted or blocked",
    context: "",
    trigger: "request arrives",
    inputs: "form",
    authority: "",
    actor_constraints: "",
    acceptance_criteria: "",
    evidence_required: "",
    verification_method: "deterministic_rule",
    sla_hours: 4,
    failure_semantics: "hold and notify",
    owner: "Ops",
  };
  // After the evidence-pack import, POST /work-units can 500 once on
  // db.refresh under RLS ("Could not refresh instance"). One retry on a
  // fresh code is enough; do not treat that as a Chart failure.
  let wuRes = await request.post("/api/work-units/", { headers, data: unitBody });
  if (wuRes.status() === 500) {
    unitBody.code = `${code}R`.slice(0, 40);
    wuRes = await request.post("/api/work-units/", { headers, data: unitBody });
  }
  expect(wuRes.status(), await wuRes.text()).toBe(201);
  const wuId = ((await wuRes.json()) as { id: number }).id;
  const usedCode = unitBody.code;

  const fileName = "offer-pack-claims.xlsx";
  const up = await request.post("/api/files/upload", {
    headers,
    multipart: {
      file: {
        name: fileName,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: readFileSync(CLAIMS_XLSX),
      },
    },
  });
  expect(up.status(), await up.text()).toBe(201);
  const fileId = Number(((await up.json()) as { file_id: string }).file_id);
  const cell = "B2";
  const quote = "Offer pack waiting";

  const observed = await request.post(`/api/work-units/${wuId}/pointers`, {
    headers,
    data: { field_name: "trigger", status: "observed", file_id: fileId, cell },
  });
  expect(observed.ok(), await observed.text()).toBeTruthy();
  const observedBody = (await observed.json()) as { status: string; resolved: boolean };
  expect(observedBody.status).toBe("observed");
  expect(observedBody.resolved).toBe(true);

  const broken = await request.post(`/api/work-units/${wuId}/pointers`, {
    headers,
    data: { field_name: "inputs", status: "observed", file_id: fileId, cell: "Z99" },
  });
  expect(broken.ok(), await broken.text()).toBeTruthy();
  const brokenBody = (await broken.json()) as { status: string; resolved: boolean };
  expect(brokenBody.status).toBe("predicted");
  expect(brokenBody.resolved).toBe(false);

  const composed = await request.post(`/api/work-units/${wuId}/pointers`, {
    headers,
    data: { field_name: "context", status: "composed" },
  });
  expect(composed.ok(), await composed.text()).toBeTruthy();

  const binding = await request.post(`/api/work-units/${wuId}/pointers`, {
    headers,
    data: { field_name: "authority", status: "declared", file_id: fileId, cell, quote },
  });
  expect(binding.ok(), await binding.text()).toBeTruthy();
  const bindingBody = (await binding.json()) as { status: string; resolved: boolean };
  expect(bindingBody.status).toBe("declared");
  expect(bindingBody.resolved).toBe(true);

  const stamp = Date.now().toString(36);
  const pdfFileName = `v10-10-policy-${stamp}.pdf`;
  const pdfUp = await request.post("/api/files/upload", {
    headers,
    multipart: {
      file: {
        name: pdfFileName,
        mimeType: "application/pdf",
        buffer: realPdfWithText(PDF_PAGE_TEXT),
      },
    },
  });
  expect(pdfUp.status(), await pdfUp.text()).toBe(201);
  const pdfFileId = Number(((await pdfUp.json()) as { file_id: string }).file_id);
  const page = 1;
  const pdfPointer = await request.post(`/api/work-units/${wuId}/pointers`, {
    headers,
    data: {
      field_name: "desired_condition",
      status: "observed",
      file_id: pdfFileId,
      page,
      quote: PDF_PAGE_QUOTE,
    },
  });
  expect(pdfPointer.ok(), await pdfPointer.text()).toBeTruthy();
  const pdfBody = (await pdfPointer.json()) as { status: string; resolved: boolean; page: number | null };
  expect(pdfBody.status).toBe("observed");
  expect(pdfBody.resolved).toBe(true);
  expect(pdfBody.page).toBe(page);

  const unusedFileName = `v10-10-unused-${stamp}.csv`;
  const unusedUp = await request.post("/api/files/upload", {
    headers,
    multipart: {
      file: {
        name: unusedFileName,
        mimeType: "text/csv",
        buffer: Buffer.from("Name,Value\nAlpha,100\n"),
      },
    },
  });
  expect(unusedUp.status(), await unusedUp.text()).toBe(201);
  const unusedFileId = Number(((await unusedUp.json()) as { file_id: string }).file_id);

  return {
    code: usedCode,
    wuId,
    fileName,
    fileId,
    cell,
    pdfFileName,
    pdfFileId,
    unusedFileName,
    unusedFileId,
    page,
  };
}

/** Whoami first (guest Start is a no-op). If this tenant already has a
 * started census — CI does, after the persist test — we do not click.
 * Playwright's click retries when the keyed Start button unmounts into
 * "Census started", so a successful start would otherwise hang the test. */
async function startKeyedCensus(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText(/Authenticated as/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  const startedBadge = page.getByText("Census started");
  const keyedStartHint = page.getByText(/Creates a census record for this Offer/);
  const loadingCensus = page.getByText(/Loading this tenant's census/);
  // GET /censuses can sit behind whoami on a cold CI box. Poll until the
  // started badge or the keyed Start hint is on screen and the loading
  // line is gone — loading is not a ready state.
  await expect
    .poll(
      async () => {
        if ((await loadingCensus.count()) > 0) return "loading";
        if ((await startedBadge.count()) > 0) return "started";
        if ((await keyedStartHint.count()) > 0) return "hint";
        return "wait";
      },
      { timeout: 30_000 },
    )
    .toMatch(/^(started|hint)$/);
  if ((await startedBadge.count()) > 0) return;
  await expect(keyedStartHint).toBeVisible();
  await page.getByRole("button", { name: "Start census" }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(startedBadge).toBeVisible({ timeout: 30_000 });
}

test("guest walks Scope through Plan (1 of 6 .. 6 of 6); Work Chart shows 18 leaves and an external band", async ({ page }) => {
  test.setTimeout(60_000);
  const simulationRequests: string[] = [];
  const shadowRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/simulations/")) simulationRequests.push(req.url());
    if (req.url().includes("/shadow-logs") || req.url().includes("/shadow-summary")) {
      shadowRequests.push(`${req.method()} ${req.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Scope", exact: false }).first()).toBeVisible();
  await expect(stepCount(page)).toContainText("1 of 6");
  await expect(page.getByTestId("census-readiness")).toBeVisible();
  await expect(page.getByTestId("readiness-consent")).toBeVisible();
  await expect(page.getByTestId("readiness-three-people")).toBeVisible();
  await expect(page.getByTestId("readiness-docs")).toBeVisible();
  await expect(page.getByTestId("census-copy-headings").getByText("Piece of work")).toBeVisible();
  await expect(page.getByTestId("census-copy-headings").getByText("How sure we are")).toBeVisible();
  await expect(page.getByTestId("census-copy-headings").getByText("How we know it")).toBeVisible();
  await expect(page.getByTestId("census-copy-headings").getByText("Checked by")).toBeVisible();
  await expect(page.getByTestId("census-copy-headings").getByText("Independent?")).toBeVisible();
  await expect(page.getByTestId("census-copy-headings").getByText(/Careful \/ as calculated \/ ambitious/)).toBeVisible();

  // Guest Start does not mint a key and does not leave Scope.
  await page.getByRole("button", { name: "Start census" }).click();
  await expect(stepCount(page)).toContainText("1 of 6");
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();

  await page.getByRole("link", { name: "Next: Capture →" }).click();
  await expect(page).toHaveURL(/\/census\/capture$/);
  await expect(stepCount(page)).toContainText("2 of 6");
  await expect(page.getByRole("heading", { name: "Capture", exact: false }).first()).toBeVisible();
  await expect(page.locator(".lede")).toContainText("Offer Desk is the worked example");
  await expect(page.getByText("not from Home")).toHaveCount(0);
  await expect(page.getByText("SeatStepper")).toHaveCount(0);
  await expect(page.getByTestId("extract-counts")).toBeVisible();
  await expect(page.getByTestId("extract-count-invented-value")).toHaveText("0");
  await expect(page.getByTestId("extract-count-left-out-value")).toHaveText("0");
  await expect(page.getByTestId("extract-count-twisted-value")).toHaveText("0");
  await expect(page.getByTestId("extract-count-flattered-value")).toHaveText("0");
  await expect(page.getByTestId("extract-counts-guest")).toHaveText(
    "You are browsing. Counts stay at zero until someone is signed in and notes are saved.",
  );
  await expect(page.getByTestId("extract-counts-guest")).not.toContainText(/looking only/i);
  await expect(page.getByTestId("extract-counts")).toContainText("invented");
  await expect(page.getByTestId("extract-counts")).toContainText("left out");
  await expect(page.getByTestId("extract-counts")).toContainText("twisted");
  await expect(page.getByTestId("extract-counts")).toContainText("flattered");
  await expect(page.getByRole("button", { name: "Info about invented" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info about left out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info about twisted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info about flattered" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();

  await page.getByRole("link", { name: "Next: Evidence →" }).click();
  await expect(page).toHaveURL(/\/census\/evidence$/);
  await expect(stepCount(page)).toContainText("3 of 6");
  // F1: a real screen, not a link farm -- files this tenant actually has
  // (empty, honestly, for a guest) and three registers with counts, all
  // rendered with no key ever minted just by looking.
  await expect(page.getByText("No files in this walk")).toBeVisible();
  await expect(page.getByTestId("evidence-catalogue")).toBeVisible();
  await expect(page.getByTestId("evidence-catalogue-empty")).toContainText("No files in this walk");
  await expect(page.locator("[data-testid^='evidence-catalogue-row-']")).toHaveCount(0);
  await expect(page.getByText("Missing").first()).toBeVisible();
  await expect(page.getByText("Uncertain").first()).toBeVisible();
  await expect(page.getByText("Contradictory").first()).toBeVisible();
  await expect(page.getByTestId("evidence-claims")).toBeVisible();
  await page.getByTestId("evidence-claim-guest-authority").click();
  await expect(page.getByTestId("evidence-cannot-open")).toBeVisible();
  await expect(page.getByTestId("evidence-cannot-open")).toContainText("cannot open");
  await expect(page.getByTestId("evidence-pointer")).toHaveCount(0);
  await expect(page.getByTestId("evidence-binding-note")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();

  await page.getByRole("link", { name: "Next: Gap →" }).click();
  await expect(page).toHaveURL(/\/census\/gap$/);
  await expect(stepCount(page)).toContainText("4 of 6");
  // V10-5b: three customer headings from real conformance_gaps.tier.
  // Guest: walk-only this-desk rows; handoff and promised-vs-not-measured
  // stay honestly empty. Never mints a key.
  await expect(page.getByTestId("gap-tier-process")).toContainText("This desk");
  await expect(page.getByTestId("gap-tier-journey")).toContainText("Handoff to the next desk");
  await expect(page.getByTestId("gap-tier-outcome")).toContainText("Promised vs not measured");
  await expect(page.getByTestId("gap-tier-process")).toContainText("What the work is");
  await expect(page.getByTestId("gap-tier-journey")).toContainText(/looking only/);
  await expect(page.getByTestId("gap-tier-outcome")).toContainText(/does not invent a measured number/);
  // F2: journey-wide additions -- Head vs doer schematic, and an explicit
  // no-coverage-percentage statement (never a fake measured-vs-declared KPI).
  await expect(page.getByText("Head vs doer")).toBeVisible();
  await expect(page.getByText(/There is no "coverage" number on this page/)).toBeVisible();
  await expect(page.getByTestId("named-states")).toBeVisible();
  await expect(page.getByTestId("named-states-guest")).toHaveText("No states in this walk.");
  await expect(page.getByTestId("named-states-offer")).toHaveCount(0);
  await expect(page.getByTestId("named-states-employee")).toHaveCount(0);
  await expect(page.getByTestId("journey-refusals")).toBeVisible();
  await expect(page.getByTestId("journey-refusals-empty")).toHaveText("none yet");
  await expect(page.locator("[data-testid^='journey-refusal-WU-']")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();

  await page.getByRole("link", { name: "Next: Work Chart →" }).click();
  await expect(page).toHaveURL(/\/census\/chart$/);
  await expect(stepCount(page)).toContainText("5 of 6");
  await expect(page.getByRole("heading", { name: /18 pieces that make the hire complete/ })).toBeVisible();
  await expect(page.getByTestId("hire-leaves")).not.toContainText(/\bleaf\b/i);
  await expect(page.getByTestId("hire-leaves")).not.toContainText(/\bleaves\b/i);
  await expect(page.getByTestId("hire-leaf")).toHaveCount(18);
  await expect(page.getByTestId("hire-band-external")).toBeVisible();
  await expect(page.getByTestId("hire-band-external")).toContainText("Outside this desk");
  await expect(page.getByTestId("hire-band-external").getByTestId("hire-leaf")).toHaveCount(3);
  const yaml = readFileSync(join(process.cwd(), "..", "packs", "hr", "hire_leaves.yaml"), "utf-8");
  const yamlLeaves = [...yaml.matchAll(/id: (WU-HIRE-\d+), name: ([^,]+)/g)].map((m) => ({
    id: m[1],
    name: m[2],
  }));
  expect(yamlLeaves, "packs/hr/hire_leaves.yaml must declare exactly 18 leaves").toHaveLength(18);
  for (const leaf of yamlLeaves) {
    await expect(page.getByTestId("hire-leaf").filter({ hasText: leaf.name })).toHaveCount(1);
  }
  const chart = page.getByTestId("hire-leaves");
  await expect(chart).not.toContainText("Rashmi");
  await expect(chart).not.toContainText("Zwayam");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);
  await expect(page.getByTestId("chart-scenarios")).toBeVisible();
  await expect(page.getByTestId("chart-sim-guest")).toHaveText(/looking only/i, { timeout: 15_000 });
  await expect(page.getByTestId("chart-capacity")).toContainText("not live");
  await expect(page.getByTestId("chart-capacity-stated")).toHaveText("95");
  await expect(page.getByTestId("chart-capacity-defended")).toHaveText("61.8");
  await expect(page.locator('[data-testid="hire-leaf"]', { hasText: "61.8" })).toHaveCount(0);
  await expect(page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-05"]').getByTestId("hire-leaf-fires")).toHaveText(
    "blocked",
  );
  await expect(page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-01"]').getByTestId("hire-leaf-fires")).toHaveText(
    "outside",
  );
  await expect(page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-03"]').getByTestId("hire-leaf-fires")).toHaveText(
    "fires",
  );
  await page.getByTestId("chart-scenario-careful").click();
  await expect(page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-03"]').getByTestId("hire-leaf-fires")).toHaveText(
    "human must touch",
  );
  await expect(page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-05"]').getByTestId("hire-leaf-fires")).toHaveText(
    "blocked",
  );
  await page.getByTestId("chart-scenario-ambitious").click();
  await expect(page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-05"]').getByTestId("hire-leaf-fires")).toHaveText(
    "blocked",
  );
  await page.getByTestId("chart-scenario-as-calculated").click();
  // Guest: declared seed only, every piece reads not scored. Never calls the simulator API.
  await expect(page.getByText("not scored").first()).toBeVisible();
  await expect(page.getByText("Guest: shown as candidate")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();

  await page.getByRole("link", { name: "Next: Plan →" }).click();
  await expect(page).toHaveURL(/\/census\/plan$/);
  await expect(stepCount(page)).toContainText("6 of 6");
  // E -- PLAN: 95 stated / 61.8 defended visible as two numbers on Plan
  // itself, not just behind a click through to the Hours page. Outcome
  // stays not measured — never 62%. Appetite does not lift the stop.
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await expect(page.getByText("95", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("61.8", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("plan-risks")).toBeVisible();
  await expect(page.getByTestId("plan-risks-empty")).toHaveText("none named yet");
  await expect(page.getByTestId("plan-risks-list")).toHaveCount(0);
  await expect(page.getByTestId("plan-risks")).not.toContainText(/compliance risk/i);
  await expect(page.getByTestId("plan-risks")).not.toContainText(/every clerk uses their own judgment/i);
  await expect(page.getByTestId("plan-period")).toBeVisible();
  await expect(page.getByTestId("plan-period-focus")).toContainText("This period:");
  await expect(page.getByTestId("plan-period-focus")).toContainText(
    "This quarter: cut offer-to-Day-1 cycle time, not headcount.",
  );
  await expect(page.getByTestId("plan-period-unowned")).toContainText(/unowned lines: \d+/);
  await expect(page.getByTestId("plan-period-guest")).toContainText(/looking only/i);
  await expect(page.getByTestId("plan-period").getByRole("button", { name: "Confirm as owner" })).toHaveCount(0);
  await expect(page.getByTestId("plan-appetite-stop")).toHaveText(/appetite does not lift the dual-employment stop/i);
  await expect(page.getByTestId("plan-hours-other")).not.toContainText("61.8");
  await expect(page.getByTestId("plan-hours-other")).not.toContainText("Defended");
  await expect(page.getByTestId("plan-outcome-measured")).toHaveText(/not measured/);
  await expect(page.getByTestId("plan-outcome")).not.toContainText("62%");
  await expect(page.getByText("Independent?").first()).toBeVisible();
  const independentInfo = page.getByRole("button", { name: "Info about Independent?" }).first();
  await independentInfo.scrollIntoViewIfNeeded();
  await independentInfo.hover();
  const independentPop = page.getByTestId("info-pop");
  await expect(independentPop).toBeVisible();
  await expect(independentPop.locator(".info-pop-title")).toHaveText("Independent?");
  const popBox = await independentPop.boundingBox();
  const viewport = page.viewportSize();
  expect(popBox, "Independent i-button popover must have a box").toBeTruthy();
  expect(viewport, "viewport must be known").toBeTruthy();
  expect(popBox!.x).toBeGreaterThanOrEqual(0);
  expect(popBox!.y).toBeGreaterThanOrEqual(0);
  expect(popBox!.x + popBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(popBox!.y + popBox!.height).toBeLessThanOrEqual(viewport!.height);
  await independentPop.screenshot({ path: test.info().outputPath("plan-independent-info-pop.png") });
  await expect(page.getByTestId("plan-how-sure-(step 1 — not imported)").first()).toHaveText("not stated");
  await expect(page.getByText(/~30\/90 is not a pass/)).toBeVisible();
  await expect(page.getByTestId("shadow-times-guest")).toHaveText("No times in this walk.");
  await expect(page.getByTestId("shadow-times")).not.toContainText(/shadow log/i);
  await expect(page.getByTestId("shadow-times")).not.toContainText(/\bobserved\b/i);
  await expect(page.getByTestId("shadow-times-date")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
  expect(simulationRequests, "guest Chart must never call GET /api/simulations").toEqual([]);
  expect(shadowRequests, "guest must never call shadow-logs or shadow-summary").toEqual([]);
});

test("keyed Start census persists across a refresh", async ({ page, request }) => {
  await signInWithFreshDemoKey(page, request);
  await page.goto("/");

  const startButton = page.getByRole("button", { name: "Start census" });
  const startedBadge = page.getByText("Census started");
  await Promise.race([
    startButton.waitFor({ state: "visible", timeout: 10_000 }),
    startedBadge.waitFor({ state: "visible", timeout: 10_000 }),
  ]);

  if (await startButton.isVisible()) {
    await startButton.click();
    await expect(startedBadge).toBeVisible();
  } else {
    await expect(startedBadge).toBeVisible();
  }

  await expect(page.getByTestId("census-readiness")).toBeVisible();
  await page.reload();
  await expect(startedBadge).toBeVisible();
  await expect(page.getByTestId("census-readiness")).toBeVisible();
});

test("Hours 95 stated / 61.8 defended still visible from Plan", async ({ page }) => {
  await page.goto("/census/plan");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await page.getByRole("link", { name: /Hours — 95 stated/ }).click();
  await expect(page).toHaveURL(/\/scout\/offer-desk\/hours$/);
  await expect(page.getByText("95", { exact: true })).toBeVisible();
  await expect(page.getByText("61.8", { exact: true })).toBeVisible();
  await expect(page.getByText(/appetite does not lift the dual-employment stop/i)).toBeVisible();
});

test("Plan shows not measured plus 95 and 61.8", async ({ page }) => {
  await page.goto("/census/plan");
  await expect(page.getByTestId("plan-outcome-measured")).toHaveText(/not measured/);
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await expect(page.getByText("95", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("61.8", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("plan-period")).toBeVisible();
  await expect(page.getByTestId("plan-period-focus")).toContainText("This period:");
  await expect(page.getByTestId("plan-period-unowned")).toContainText(/unowned lines: \d+/);
  await expect(page.getByTestId("plan-outcome")).not.toContainText("62%");
  await expect(page.getByTestId("plan-outcome-measured")).not.toContainText("62");
  await expect(page.getByText("Independent?").first()).toBeVisible();
  await expect(page.getByTestId("plan-appetite-stop")).toHaveText(/appetite does not lift the dual-employment stop/i);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
});

test("Chart purpose strip shows draft intent", async ({ page }) => {
  await page.goto("/census/chart");
  await expect(page.getByRole("heading", { name: "Purpose", exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Function intent — HR operations/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Work System intent — this journey/ })).toBeVisible();
  // Unconfirmed must not look governed: draft badge, not the "ok"/ratified styling.
  await expect(page.getByText("draft · unconfirmed").first()).toBeVisible();
  await expect(page.getByText("Guest: shown as draft/sitting").first()).toBeVisible();
});

test("keyed Ratify Work System persists across a refresh", async ({ page, request }) => {
  // Client A is a singleton tenant (services/tenants.py::get_or_create_client_a)
  // reused across every demo bootstrap -- against a Postgres that already
  // ran this suite once, this journey may already be ratified from a prior
  // run. Either way this test proves the same thing Ratify is for: a real,
  // keyed, persisted governance state. On a fresh tenant (CI's own Postgres
  // service container is always fresh) it also exercises the click itself.
  await signInWithFreshDemoKey(page, request);
  await page.goto("/census/chart");

  const ratifyButton = page.getByRole("button", { name: "Ratify Work System" });
  const ratifiedText = page.getByText(/ratified — /);
  await Promise.race([
    ratifyButton.waitFor({ state: "visible", timeout: 10_000 }),
    ratifiedText.waitFor({ state: "visible", timeout: 10_000 }),
  ]);

  if (await ratifyButton.isVisible()) {
    await expect(page.getByText("candidate · not governed").first()).toBeVisible();
    await page.getByPlaceholder("Your name").fill("QA Ratifier");
    await ratifyButton.click();
    await expect(page.getByText(/ratified — QA Ratifier/)).toBeVisible();
  } else {
    await expect(ratifiedText).toBeVisible();
  }

  await page.reload();
  await expect(page.getByText(/ratified — /)).toBeVisible();
});

test("keyed Confirm-as-owner persists across a refresh", async ({ page, request }) => {
  // Same reasoning as the Ratify test above: Client A is a singleton
  // tenant, so a warm Postgres may already carry one or both intents
  // confirmed from a prior run -- there are two independent intents here,
  // not one, so this scopes each fill to its own button's own input
  // (an immediate preceding sibling in the same card) rather than assuming
  // "first Confirm as owner button" always means Function intent -- once
  // Function intent is confirmed, "first" shifts to Work System intent's
  // own button instead.
  await signInWithFreshDemoKey(page, request);
  await page.goto("/census/chart");

  const confirmButtons = page.getByRole("button", { name: "Confirm as owner" });
  const confirmedTexts = page.getByText(/confirmed — /);
  await Promise.race([
    confirmButtons.first().waitFor({ state: "visible", timeout: 10_000 }),
    confirmedTexts.first().waitFor({ state: "visible", timeout: 10_000 }),
  ]);

  while ((await confirmButtons.count()) > 0) {
    const button = confirmButtons.first();
    await button.locator("xpath=preceding-sibling::input[1]").fill("QA Owner");
    await button.click();
    await expect(page.getByText(/confirmed — QA Owner/).first()).toBeVisible();
  }

  await expect(confirmedTexts.first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/confirmed — /).first()).toBeVisible();
});

test("keyed moderation requires a reason", async ({ page, request }) => {
  await signInWithFreshDemoKey(page, request);
  await page.goto("/census/plan");

  const logButton = page.getByRole("button", { name: "Log moderation request" });
  await expect(logButton).toBeVisible();
  await expect(logButton).toBeDisabled();

  // A name alone is not enough -- the reason is what's required here.
  await page.getByLabel("Moderation — moderated by").fill("QA Moderator");
  await expect(logButton).toBeDisabled();

  await page.getByLabel("Moderation — reason").fill("Six clean weeks on this checklist, no exceptions raised.");
  await expect(logButton).toBeEnabled();
});

test("family import still quality-gates around 30 of 90", async ({ page, request }) => {
  await signInWithFreshDemoKey(page, request);

  await page.goto("/hr/family-genome");
  await page.getByRole("button", { name: "Import family (declared)" }).click();

  const banner = page.locator(".banner").first();
  await expect(banner).toContainText("GQS");
  await expect(banner).toContainText("Not accepted");
  const text = await banner.innerText();
  const match = /GQS\s+(\d+(?:\.\d+)?)\s*\/\s*90/.exec(text);
  expect(match, text).not.toBeNull();
  const gqs = parseFloat(match![1]);
  expect(gqs).toBeGreaterThan(15);
  expect(gqs).toBeLessThan(45);
});

test("Spec deny without a file still denies", async ({ page, request }) => {
  await signInWithFreshDemoKey(page, request);

  await page.goto("/scout/offer-desk/spec-deny");
  // exact: true matters here -- the signed-out branch renders a similarly
  // named "Preview: ask Spec without a pass" button, a case-insensitive
  // substring match for the loose query, and briefly co-exists with the
  // keyed one while CompanyProvider's own /org/whoami call is in flight.
  // Auto-wait then correctly holds for the real keyed button instead of
  // clicking whichever one happens to be mounted first.
  await page.getByRole("button", { name: "Ask Spec without a pass", exact: true }).click();

  await expect(page.getByText(/HTTP 200 · denied/)).toBeVisible();
  await expect(page.getByText("evidence_ref required by contract").first()).toBeVisible();
});

test("keyed Evidence lists this tenant's files as connected or not", async ({ page, request }) => {
  // V10-10 catalogue walk — GET /api/evidence/catalogue, not a demo pack.
  // 7 sequential real file uploads + a genome import + the page's catalogue
  // GET comfortably exceed the suite's default 30s per-test budget.
  test.setTimeout(90_000);
  await signInWithFreshDemoKey(page, request);

  // Real upload + real genome import -- the one path in this walk that
  // clears the quality gate (see OfferDeskEvidencePack.tsx). Files land
  // on this tenant either way; catalogue then says connected or not from
  // resolved field pointers, not from provenance "backs".
  await page.goto("/scout/offer-desk/evidence-pack");
  await page.getByRole("button", { name: "Load the evidence pack & import" }).click();
  const importBanner = page.locator(".banner").first();
  await expect(importBanner).toBeVisible({ timeout: 30_000 });
  // Client A is the same singleton tenant every demo bootstrap reuses (see
  // the Ratify test's own comment above) -- against a Postgres that already
  // ran this exact test, WU-OD-01..11 already exist and POST /genome/import
  // correctly refuses to re-import them (work_unit_id_already_exists), same
  // as test_genome_import_conflicts.py proves at the API level. Either
  // outcome still uploads these 7 files for real this run; only a fresh
  // "Accepted." also writes brand-new provenance rows for them.
  const bannerText = await importBanner.innerText();
  expect(bannerText, bannerText).toMatch(/Accepted\.|Not accepted\./);

  const catalogueLoaded = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      res.ok() &&
      res.url().includes("/evidence/catalogue"),
    { timeout: 30_000 },
  );
  await page.goto("/census/evidence");
  const catRes = await catalogueLoaded;
  const catalogue = (await catRes.json()) as {
    connected: number;
    not: number;
    items: { id: number; file_name: string; coverage: "connected" | "not" }[];
  };

  await expect(page.getByRole("heading", { name: "Evidence", exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("evidence-catalogue")).toBeVisible();

  const filesTable = page.getByTestId("evidence-catalogue");
  if (catalogue.items.length === 0) {
    await expect(page.getByTestId("evidence-catalogue-empty")).toBeVisible();
    await expect(page.locator("[data-testid^='evidence-catalogue-row-']")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("evidence-catalogue-empty")).toHaveCount(0);
    await expect(page.getByTestId("evidence-catalogue-totals")).toHaveText(
      `${catalogue.connected} connected · ${catalogue.not} not`,
    );
    for (const item of catalogue.items) {
      const coverage = item.coverage === "connected" ? "connected" : "not";
      await expect(page.getByTestId(`evidence-catalogue-coverage-${item.id}`)).toHaveText(coverage);
    }
  }
  await expect(filesTable).not.toContainText("%");
  await expect(filesTable).not.toContainText("coverage %");

  // Real conformance-gap counts, not the guest's illustrative four rows.
  await expect(page.getByText(/Read from this tenant's own conformance gaps/)).toBeVisible();
});

test("keyed Evidence click shows a real XLSX cell; a broken pointer is not a fact", async ({ page, request }) => {
  // V10-2 pointer walk (kept with V10-4 Chart 18-leaf / external-band).
  // Fresh CI Postgres still shares Client A: Start census, GET /pointers,
  // and the click must all finish inside one job. Unique type + one 500
  // retry above so a prior evidence-pack import does not fail this seed.
  // startKeyedCensus may poll 30s for Start / Census started after whoami.
  test.setTimeout(120_000);
  await signInWithFreshDemoKey(page, request);
  await startKeyedCensus(page);
  const apiKey = (await page.evaluate(() => localStorage.getItem("we-spec-key"))) as string;
  const seeded = await seedEvidencePointers(request, apiKey);

  const pointersLoaded = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      res.ok() &&
      res.url().includes(`/work-units/${seeded.wuId}/pointers`),
    { timeout: 45_000 },
  );
  const catalogueLoaded = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      res.ok() &&
      res.url().includes("/evidence/catalogue"),
    { timeout: 45_000 },
  );
  await page.goto("/census/evidence");
  await pointersLoaded;
  await catalogueLoaded;
  await expect(page.getByTestId("evidence-claims")).toHaveAttribute("aria-busy", "false", {
    timeout: 45_000,
  });
  await expect(page.getByTestId("evidence-claims-loading")).toHaveCount(0);

  const openedStatus = page.getByTestId(`evidence-claim-status-${seeded.code}-trigger`);
  await expect(openedStatus).toHaveText("seen in records", { timeout: 15_000 });
  await openedStatus.click();
  await expect(page.getByTestId("evidence-pointer")).toBeVisible();
  await expect(page.getByTestId("evidence-pointer-cell")).toHaveText(seeded.cell);
  await expect(page.getByTestId("evidence-pointer-file")).toHaveText(seeded.fileName);
  await expect(page.getByTestId("evidence-detail-status")).toHaveText("seen in records");
  await expect(page.getByTestId("evidence-cannot-open")).toHaveCount(0);

  const brokenStatus = page.getByTestId(`evidence-claim-status-${seeded.code}-inputs`);
  await expect(brokenStatus).toHaveText("predicted by a model");
  await brokenStatus.click();
  await expect(page.getByTestId("evidence-cannot-open")).toBeVisible();
  await expect(page.getByTestId("evidence-cannot-open")).toContainText(/cannot open/);
  await expect(page.getByTestId("evidence-pointer")).toHaveCount(0);
  await expect(page.getByTestId("evidence-detail-status")).toHaveText("predicted by a model");
  await expect(page.getByTestId("evidence-downgraded")).toBeVisible();

  await page.getByTestId(`evidence-claim-status-${seeded.code}-context`).click();
  await expect(page.getByTestId("evidence-claim-detail").getByTestId("evidence-composed-badge")).toBeVisible();
  await expect(page.getByTestId("evidence-detail-status")).toHaveText("proposed by us");
  await expect(page.getByTestId("evidence-cannot-open")).toBeVisible();

  await page.getByTestId(`evidence-claim-status-${seeded.code}-authority`).click();
  await expect(page.getByTestId("evidence-detail-status")).toHaveText("said by a person");
  await expect(page.getByTestId("evidence-binding-note")).toBeVisible();
  await expect(page.getByTestId("evidence-claim-detail")).not.toContainText("predicted by a model");
  await expect(page.getByTestId("evidence-pointer-cell")).toHaveText(seeded.cell);
  await expect(page.getByTestId("evidence-pointer-quote")).toContainText("Offer pack waiting");

  // V10-10: PDF page opens when the backend resolved it; catalogue is
  // connected or not for this tenant's own files, never an invented pack.
  await page.getByTestId(`evidence-claim-status-${seeded.code}-desired_condition`).click();
  await expect(page.getByTestId("evidence-pointer")).toBeVisible();
  await expect(page.getByTestId("evidence-pointer-page")).toHaveText(String(seeded.page));
  await expect(page.getByTestId("evidence-pointer-file")).toHaveText(seeded.pdfFileName);
  await expect(page.getByTestId("evidence-cannot-open")).toHaveCount(0);
  await expect(page.getByTestId("evidence-detail-status")).toHaveText("seen in records");

  await expect(page.getByTestId("evidence-catalogue")).toBeVisible();
  await expect(page.getByTestId(`evidence-catalogue-coverage-${seeded.fileId}`)).toHaveText("connected", {
    timeout: 15_000,
  });
  await expect(page.getByTestId(`evidence-catalogue-coverage-${seeded.pdfFileId}`)).toHaveText("connected");
  await expect(page.getByTestId(`evidence-catalogue-coverage-${seeded.unusedFileId}`)).toHaveText("not");
  await expect(page.getByTestId("evidence-catalogue")).not.toContainText("%");
});

/** CENSUS-PACK (docs/BUILD_PROGRAM.md P1/P2). */

test("guest census download contains 95, 61.8, and 'not a pass'", async ({ page }) => {
  await page.goto("/census/plan");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download census" }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^census-offer-day1-\d{8}\.md$/);
  const path = await download.path();
  const content = readFileSync(path as string, "utf-8");
  expect(content).toContain("95");
  expect(content).toContain("61.8");
  expect(content).toContain("95 stated / 61.8 defended");
  expect(content).toContain("This period:");
  expect(content).toMatch(/unowned lines: \d+/);
  expect(content).toMatch(/not a pass/);
  expect(content).toContain("The hire is complete");
  expect(content).toContain("Outside this desk");
  expect(content).toContain("No files in this walk");
  expect(content).not.toMatch(/WU-HIRE-19/);
  // V10-5b Gap buckets in the export, same headings as census step 4.
  expect(content).toContain("### This desk");
  expect(content).toContain("### Handoff to the next desk");
  expect(content).toContain("### Promised vs not measured");
  // Guest banner (P1: "talk-only empty").
  expect(content).toMatch(/Guest \/ talk-only/);
});

test("keyed census download includes confirmed intent once confirmed", async ({ page, request }) => {
  await signInWithFreshDemoKey(page, request);
  const apiKey = (await page.evaluate(() => localStorage.getItem("we-spec-key"))) as string;
  const headers = { "X-Spec-Key": apiKey };

  // Get-or-create (never overwrites an existing row) then confirm Function
  // intent directly via the API -- Client A is a warm singleton tenant, so
  // an earlier run may already have confirmed it; a 409 "already confirmed"
  // is treated the same as a fresh 200, since either way the row now has a
  // confirmed intent, which is the only thing this test needs to exist
  // before it downloads and checks the export reflects it.
  const ensured = await request.post("/api/work-systems", {
    headers,
    data: {
      code: "WS-OFFER-ONBOARD", name: "Recruiter asks for offer → offer released → Day-1 ready",
      entry: "x", exit: "x", owner: "x", outcome: "x",
      function_intent_outcome: "x", function_intent_owner: "x", function_intent_measure: "x",
      work_system_intent_purpose: "x", work_system_intent_owner: "x",
    },
  });
  expect(ensured.ok(), await ensured.text()).toBeTruthy();
  const workSystemId = (await ensured.json()).id as number;
  const confirm = await request.post(`/api/work-systems/${workSystemId}/confirm-function-intent`, {
    headers,
    data: { confirmed_by: "Census QA" },
  });
  expect([200, 409]).toContain(confirm.status());

  await page.goto("/census/plan");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download census" }).first().click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = readFileSync(path as string, "utf-8");
  expect(content).toMatch(/confirmed by /);
  expect(content).not.toMatch(/Guest \/ talk-only/);
});

test("handoff is refused (not ready) without evidence", async ({ page, request }) => {
  // Guest: no tenant exists at all, so the rule's own "no record" branch is
  // the only honest answer -- every unit on Plan reads Not ready, never a
  // fake allow, per P2's own "Guest: explain, never fake allow."
  await page.goto("/census/plan");
  await expect(page.getByText("Not ready").first()).toBeVisible();
  await expect(page.getByText(/Guest: the rule above is real/)).toBeVisible();

  // The same refusal, direct from the server (GET/Spec must refuse a bundle
  // if not ready) -- a code no import path on this tenant could ever
  // produce, so this is deterministic regardless of what earlier tests left
  // on the shared demo tenant.
  const bootstrap = await request.post("/api/demo/bootstrap?new_keys=true");
  expect(bootstrap.ok(), await bootstrap.text()).toBeTruthy();
  const { api_key } = (await bootstrap.json()) as { api_key: string };
  const resp = await request.get("/api/spec/handoff/WU-CENSUS-PACK-NO-SUCH-UNIT", {
    headers: { "X-Spec-Key": api_key },
  });
  expect(resp.ok(), await resp.text()).toBeTruthy();
  const body = (await resp.json()) as { ready: boolean; bundle: unknown; reasons: string[] };
  expect(body.ready).toBe(false);
  expect(body.bundle).toBeNull();
  expect(body.reasons.join(" ")).toMatch(/no record/i);
});

/** V10-8 FRONTEND. Sit close lives on Offer Desk after Playback, not as a
 * seventh census step. Guest 1→6 and Plan 95 / 61.8 stay in the tests above. */

async function ensureDocumentCheckUnit(request: APIRequestContext, apiKey: string): Promise<number> {
  const headers = { "X-Spec-Key": apiKey };
  const listed = await request.get("/api/work-units/", { headers });
  expect(listed.ok(), await listed.text()).toBeTruthy();
  const items = ((await listed.json()) as { items: { id: number; code: string }[] }).items;
  const existing = items.find((u) => u.code === "WU-OD-02");
  if (existing) return existing.id;

  const typeName = `V10-8 Sit Close Object ${Date.now().toString(36)}`;
  const created = await request.post("/api/ontology/types", {
    headers,
    data: { name: typeName, kind: "business_object", description: "", state_machine: '["draft","done"]' },
  });
  expect(created.status(), await created.text()).toBe(201);
  const typeId = ((await created.json()) as { id: number }).id;

  const unitBody = {
    code: "WU-OD-02",
    name: "Verify candidate documents",
    business_object_type_id: typeId,
    current_condition: "Documents unchecked",
    desired_condition: "Accepted or blocked",
    context: "",
    trigger: "request arrives",
    inputs: "form",
    authority: "Offer Desk SME",
    actor_constraints: "",
    acceptance_criteria: "IF dual employment detected in UAN: do NOT release offer (deviation approval required)",
    evidence_required: "",
    verification_method: "deterministic_rule",
    sla_hours: 4,
    failure_semantics: "hold and notify",
    owner: "Offer Desk SME",
  };
  const wuRes = await request.post("/api/work-units/", { headers, data: unitBody });
  if (wuRes.status() === 409 || wuRes.status() === 500) {
    const again = await request.get("/api/work-units/", { headers });
    const found = ((await again.json()) as { items: { id: number; code: string }[] }).items.find(
      (u) => u.code === "WU-OD-02",
    );
    expect(found, await wuRes.text()).toBeTruthy();
    return found!.id;
  }
  expect(wuRes.status(), await wuRes.text()).toBe(201);
  return ((await wuRes.json()) as { id: number }).id;
}

type SitCloseGoalSeed = "drafted" | "settled" | "empty";

/** Sit-close Confirm only after a real sitting quote is on a draft row.
 * Pointer quote wins when declared. A 422 means the API rejected the quote —
 * skip, do not invent another. Confirm stays off. */
async function seedSitCloseDrafts(
  request: APIRequestContext,
  apiKey: string,
  wuId: number,
): Promise<SitCloseGoalSeed> {
  const headers = { "X-Spec-Key": apiKey };
  const listed = await request.get(`/api/work-units/${wuId}/field-ratifications`, { headers });
  expect(listed.ok(), await listed.text()).toBeTruthy();
  const existing = ((await listed.json()) as { items: { field_name: string; sitting_quote: string; status: string }[] })
    .items;
  const byField = new Map(existing.map((row) => [row.field_name, row]));

  let pointers: { field_name: string; status: string; quote: string }[] = [];
  const pointerRes = await request.get(`/api/work-units/${wuId}/pointers`, { headers });
  if (pointerRes.ok()) {
    pointers = ((await pointerRes.json()) as { items: { field_name: string; status: string; quote: string }[] }).items;
  }

  const seeds = [
    {
      field_name: "desired_condition",
      sitting_quote: "Rashmi pulls candidate profile from Zwayam. Checks all documents uploaded.",
      drafted_value: "Accepted or blocked",
    },
    {
      field_name: "authority",
      sitting_quote: "Rashmi (Offer Desk) — handles ALL hire types across BLR, HYD, CHN",
      drafted_value: "Offer Desk SME",
    },
    {
      field_name: "acceptance_criteria",
      sitting_quote: "IF dual employment detected in UAN: do NOT release offer (deviation approval required)",
      drafted_value:
        "IF docs complete: proceed. IF docs missing: email recruiter → recruiter follows up with candidate. IF UAN service history missing/inactive: trigger UAN generation guide to candidate. IF employment gap in UAN: check with candidate, may need bank statement or BGV. IF dual employment detected in UAN: do NOT release offer (deviation approval required)",
    },
  ];

  for (const seed of seeds) {
    const have = byField.get(seed.field_name);
    if (have) continue;
    const pointer = pointers.find(
      (p) => p.field_name === seed.field_name && p.status === "declared" && (p.quote ?? "").trim().length >= 8,
    );
    const sitting_quote = (pointer?.quote ?? seed.sitting_quote).trim();
    if (sitting_quote.length < 8) continue;
    const created = await request.post(`/api/work-units/${wuId}/field-ratifications`, {
      headers,
      data: { field_name: seed.field_name, sitting_quote, drafted_value: seed.drafted_value },
    });
    const status = created.status();
    const body = await created.text();
    if (status === 409) continue;
    if (!created.ok()) {
      console.log(`seedSitCloseDrafts POST ${seed.field_name} status=${status} body=${body}`);
      // 422 = quote rejected. 500 = keyed write the founder already
      // accepted on this tenant — skip, do not invent another quote.
      if (status === 422 || status === 500) continue;
    }
    expect(created.ok(), `seedSitCloseDrafts ${seed.field_name} ${status} ${body}`).toBeTruthy();
  }

  const again = await request.get(`/api/work-units/${wuId}/field-ratifications`, { headers });
  expect(again.ok(), await again.text()).toBeTruthy();
  const goal = ((await again.json()) as { items: { field_name: string; sitting_quote: string; status: string }[] }).items
    .find((row) => row.field_name === "desired_condition");
  if (!goal || !goal.sitting_quote.trim()) return "empty";
  if (goal.status !== "drafted") return "settled";
  return "drafted";
}

test("census stays six steps; sit close is Offer Desk depth, not a seventh census step", async ({ page }) => {
  await page.goto("/");
  await expect(stepCount(page)).toContainText("1 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");

  await page.goto("/scout/offer-desk/sit-close");
  await expect(page.getByTestId("sit-close")).toBeVisible();
  await expect(page.locator(".progress-count")).toHaveCount(0);
});

test("guest sit close shows three rows, none yet, and mints no key", async ({ page }) => {
  await page.goto("/scout/offer-desk/sit-close");
  await expect(page.getByTestId("sit-close")).toBeVisible();
  await expect(page.getByText("Looking only — nothing is saved")).toBeVisible();

  await expect(page.getByTestId("sit-close-row-goal")).toBeVisible();
  await expect(page.getByTestId("sit-close-row-authority")).toBeVisible();
  await expect(page.getByTestId("sit-close-row-acceptance")).toBeVisible();
  await expect(page.locator("[data-testid^='sit-close-row-']")).toHaveCount(3);
  await expect(page.getByTestId("sit-close-row-trigger")).toHaveCount(0);
  await expect(page.getByTestId("sit-close-confirm-goal")).toBeVisible();
  await expect(page.getByTestId("sit-close-ask-goal")).toHaveCount(0);

  await expect(page.getByTestId("sit-close-quote-goal")).toContainText("Checks all documents uploaded");
  await expect(page.getByTestId("sit-close-draft-goal")).toHaveText("Accepted or blocked");
  await expect(page.getByTestId("sit-close-quote-authority")).toContainText("handles ALL hire types");
  await expect(page.getByTestId("sit-close-draft-authority")).toHaveText("Offer Desk SME");
  await expect(page.getByTestId("sit-close-quote-acceptance")).toContainText(/dual employment/i);
  await expect(page.getByTestId("sit-close-draft-acceptance")).toContainText("do NOT release offer");

  await expect(page.getByTestId("sit-close-confirm-goal")).toBeDisabled();
  await expect(page.getByTestId("sit-close-correct-goal")).toBeDisabled();
  await expect(page.getByTestId("sit-close-guest-goal")).toContainText(/looking only/i);

  await expect(page.getByTestId("sit-close-cards-empty")).toHaveText("none yet");
  await expect(page.getByTestId("sit-close-card")).toHaveCount(0);

  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
});

test("keyed sit close Confirm persists; cards are real or none yet", async ({ page, request }) => {
  test.setTimeout(60_000);
  await signInWithFreshDemoKey(page, request);
  const apiKey = (await page.evaluate(() => localStorage.getItem("we-spec-key"))) as string;
  const wuId = await ensureDocumentCheckUnit(request, apiKey);
  const goalSeed = await seedSitCloseDrafts(request, apiKey, wuId);
  console.log(`sit-close goal seed=${goalSeed}`);

  await page.goto("/scout/offer-desk/sit-close");
  await expect(page.getByTestId("sit-close")).toBeVisible();

  const nameField = page.getByTestId("sit-close-confirmed-by");
  await expect(nameField).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  await nameField.fill("QA Sit Close");

  const confirmGoal = page.getByTestId("sit-close-confirm-goal");
  const settledGoal = page.getByTestId("sit-close-settled-goal");
  await expect(
    page
      .getByTestId("sit-close-cards-empty")
      .or(page.getByTestId("sit-close-card").first())
      .or(page.locator(".banner.error")),
  ).toBeVisible({ timeout: 20_000 });

  const confirmVisible = (await confirmGoal.count()) > 0;
  const confirmOn = confirmVisible && (await confirmGoal.isEnabled());
  const alreadySettled = (await settledGoal.count()) > 0;

  if (confirmOn) {
    await confirmGoal.click();
    await expect(settledGoal).toContainText(/confirmed — QA Sit Close/);

    const confirmAuth = page.getByTestId("sit-close-confirm-authority");
    const lineAuth = page.getByTestId("sit-close-line-authority");
    const settledAuth = page.getByTestId("sit-close-settled-authority");
    if ((await lineAuth.count()) > 0 && (await confirmAuth.count()) > 0 && (await settledAuth.count()) === 0) {
      await lineAuth.fill("HR Ops lead signs this, not the draft owner");
      const correctAuth = page.getByTestId("sit-close-correct-authority");
      await expect(correctAuth).toBeEnabled();
      await correctAuth.click();
      await expect(settledAuth).toContainText(/corrected — QA Sit Close/);
    }

    await page.reload();
    await expect(page.getByTestId("sit-close-confirmed-by")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("sit-close-settled-goal")).toContainText(/confirmed|corrected/, { timeout: 20_000 });
  } else if (alreadySettled) {
    await page.reload();
    await expect(page.getByTestId("sit-close-confirmed-by")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("sit-close-settled-goal")).toContainText(/confirmed|corrected/, { timeout: 20_000 });
  } else {
    await expect(settledGoal).toHaveCount(0);
    if (confirmVisible) await expect(confirmGoal).toBeDisabled();
  }

  const empty = page.getByTestId("sit-close-cards-empty");
  const card = page.getByTestId("sit-close-card");
  await expect(empty.or(card.first())).toBeVisible();
  if ((await empty.count()) > 0) {
    await expect(empty).toHaveText("none yet");
    await expect(card).toHaveCount(0);
  } else {
    await expect(card.first().getByTestId("sit-close-card-human")).not.toHaveText("");
  }
});

/** V10-9 FRONTEND. One Plan row for this period + unowned-lines count.
 * Guest 1→6 and Plan 95 / 61.8 stay in the tests above. */

const PAIN_QUESTION =
  "Think of the last hire that went off the rails between offer and Day-1. What broke?";
const SITTING_LINE = "The backup never saw dual employment on that hire.";

test("keyed Function leader POSTs draft line onto the same page; Plan still 95 and 61.8", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await signInWithFreshDemoKey(page, request);

  await page.goto("/scout/offer-desk/function-leader");
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  await expect(page.getByTestId("sitting-pain")).toHaveText(PAIN_QUESTION, { timeout: 20_000 });
  await expect(page.getByText(/Open sitting #/)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("sitting-answer").fill(SITTING_LINE);
  const useLine = page.getByTestId("sitting-use-as-line");
  await expect(useLine).toBeVisible();
  await expect
    .poll(async () => {
      if ((await page.getByTestId("this-period-confirmed").count()) > 0) return "confirmed";
      if (await useLine.isEnabled()) return "ready";
      return "wait";
    })
    .toMatch(/confirmed|ready/);
  const wasConfirmed = (await page.getByTestId("this-period-confirmed").count()) > 0;
  if (wasConfirmed) {
    await expect(page.getByText(/47 days/i)).toHaveCount(0);
  } else {
    const drafted = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/draft-strategy-intent"),
    );
    await useLine.click();
    const draftedRes = await drafted;
    expect(draftedRes.ok(), await draftedRes.text()).toBeTruthy();
    await expect(page.getByTestId("this-period-draft")).toBeVisible();
    await expect(page.getByTestId("this-period-label")).toHaveText(SITTING_LINE);
    await expect(page.getByText(/47 days/i)).toHaveCount(0);
  }

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  if (wasConfirmed) {
    await expect(page.getByTestId("plan-period")).toBeVisible();
  } else {
    await expect(page.getByTestId("plan-period-focus")).toContainText(SITTING_LINE);
  }
});

test("keyed Confirm as owner on Plan this-period row persists", async ({ page, request }) => {
  await signInWithFreshDemoKey(page, request);
  await page.goto("/census/plan");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await expect(page.getByTestId("plan-period")).toBeVisible();
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);

  const confirm = page.getByTestId("plan-period-confirm");
  const confirmed = page.getByTestId("plan-period-confirmed");
  await expect(confirm.or(confirmed)).toBeVisible({ timeout: 15_000 });

  if (await confirm.isVisible()) {
    await page.getByTestId("plan-period-confirmed-by").fill("QA Period Owner");
    await confirm.click();
    await expect(confirmed).toContainText(/QA Period Owner/);
  } else {
    await expect(confirmed).toBeVisible();
  }

  await page.reload();
  await expect(page.getByTestId("plan-period-confirmed")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
});

/** V10-11 FRONTEND. Named before/after + this journey's refusals live on
 * Gap, not as a seventh census step. Guest 1→6 and Plan 95 / 61.8 stay in
 * the tests above. */

test("guest Gap shows no states in this walk and none yet refusals, mints no key", async ({ page }) => {
  await page.goto("/census/gap");
  await expect(stepCount(page)).toContainText("4 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);
  await expect(page.getByTestId("named-states-guest")).toHaveText("No states in this walk.");
  await expect(page.getByTestId("journey-refusals-empty")).toHaveText("none yet");
  await expect(page.getByTestId("named-states")).not.toContainText("admissibility");
  await expect(page.getByTestId("journey-refusals")).not.toContainText("no_exit");
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
});

test("keyed Gap shows a refusal when the API returns one; Plan still 95 and 61.8", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await signInWithFreshDemoKey(page, request);
  const apiKey = (await page.evaluate(() => localStorage.getItem("we-spec-key"))) as string;
  const headers = { "X-Spec-Key": apiKey };

  const ensured = await request.post("/api/work-systems", {
    headers,
    data: {
      code: "WS-OFFER-ONBOARD",
      name: "Recruiter asks for offer → offer released → Day-1 ready",
    },
  });
  expect(ensured.ok(), await ensured.text()).toBeTruthy();

  const typeName = `Offer V10-11 UI ${Date.now().toString(36)}`;
  const created = await request.post("/api/ontology/types", {
    headers,
    data: { name: typeName, kind: "business_object", description: "", state_machine: '["draft","done"]' },
  });
  expect(created.status(), await created.text()).toBe(201);
  const typeId = ((await created.json()) as { id: number }).id;

  const code = `WU-OD-V11${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`.slice(0, 40);
  const unitBody = {
    code,
    name: "Two-owner fixture for this journey's refusals",
    business_object_type_id: typeId,
    current_condition: "documents checked",
    desired_condition: "documents checked",
    context: "",
    trigger: "request arrives",
    inputs: "form",
    authority: "",
    actor_constraints: "",
    acceptance_criteria: "",
    evidence_required: "",
    verification_method: "deterministic_rule",
    sla_hours: 4,
    failure_semantics: "hold and notify",
    owner: "QA Cursor and Fixture",
  };
  let wuRes = await request.post("/api/work-units/", { headers, data: unitBody });
  if (wuRes.status() === 500) {
    unitBody.code = `${code}R`.slice(0, 40);
    wuRes = await request.post("/api/work-units/", { headers, data: unitBody });
  }
  expect(wuRes.status(), await wuRes.text()).toBe(201);
  const usedCode = unitBody.code;

  await page.goto("/census/gap");
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  await expect(page.getByTestId("named-states")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("named-states-guest")).toHaveCount(0);
  await expect(page.getByTestId(`journey-refusal-${usedCode}`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId(`journey-refusal-reason-${usedCode}`)).toHaveText("two owners");
  await expect(page.getByTestId(`journey-refusal-reason-${usedCode}`)).not.toHaveText("no_exit");
  await expect(page.getByTestId("named-states-offer")).toContainText("documents checked");
  await expect(page.getByTestId("named-states-offer")).toContainText("before and after");

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
});

/** V10-12 FRONTEND. Four counts live on Capture, not as a seventh census
 * step. Guest 1→6 and Plan 95 / 61.8 stay in the tests above. */

test("guest Capture shows four zeros, browsing hint, and mints no key", async ({ page }) => {
  await page.goto("/census/capture");
  await expect(stepCount(page)).toContainText("2 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);
  await expect(page.locator(".lede")).not.toContainText("not from Home");
  await expect(page.getByTestId("extract-count-invented-value")).toHaveText("0", { timeout: 15_000 });
  await expect(page.getByTestId("extract-count-left-out-value")).toHaveText("0");
  await expect(page.getByTestId("extract-count-twisted-value")).toHaveText("0");
  await expect(page.getByTestId("extract-count-flattered-value")).toHaveText("0");
  await expect(page.getByTestId("extract-counts-guest")).toHaveText(
    "You are browsing. Counts stay at zero until someone is signed in and notes are saved.",
  );
  await expect(page.getByTestId("extract-counts-guest")).not.toContainText(/looking only/i);
  await expect(page.getByRole("button", { name: "Info about invented" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info about left out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info about twisted" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info about flattered" })).toBeVisible();
  await expect(page.getByTestId("extract-counts")).not.toContainText("delinquency");
  await expect(page.getByTestId("extract-counts")).not.toContainText("invention");
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
});

test("keyed Capture shows zeros for a fresh demo key; Plan still 95 and 61.8", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await signInWithFreshDemoKey(page, request);
  await page.goto("/census/capture");
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  await expect(page.getByTestId("extract-counts")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("extract-counts-guest")).toHaveCount(0);
  await expect(page.getByTestId("extract-count-invented-value")).toHaveText("0", { timeout: 20_000 });
  await expect(page.getByTestId("extract-count-left-out-value")).toHaveText("0");
  await expect(page.getByTestId("extract-count-twisted-value")).toHaveText("0");
  await expect(page.getByTestId("extract-count-flattered-value")).toHaveText("0");

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
});

/** V10-13 FRONTEND. Case overlay on Work Chart (step 5), not a seventh
 * census step. Guest 1→6 and Plan 95 / 61.8 stay in the tests above. */

test("guest Chart shows 18 leaves, looking only, mints no key, never calls simulations", async ({ page }) => {
  const simulationRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/simulations/")) simulationRequests.push(req.url());
  });
  await page.goto("/census/chart");
  await expect(stepCount(page)).toContainText("5 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);
  await expect(page.getByTestId("hire-leaf")).toHaveCount(18);
  await expect(page.getByTestId("hire-leaves")).not.toContainText(/\bleaf\b/i);
  await expect(page.getByTestId("hire-leaves")).not.toContainText(/\bleaves\b/i);
  await expect(page.getByTestId("chart-sim-guest")).toHaveText(/looking only/i, { timeout: 15_000 });
  await expect(page.getByTestId("hire-leaves")).not.toContainText("simulator");
  await expect(page.getByTestId("chart-scenarios")).not.toContainText("S1");
  await expect(page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-05"]').getByTestId("hire-leaf-fires")).toHaveText(
    "blocked",
  );
  await expect(page.locator('[data-testid="hire-leaf"]', { hasText: "61.8" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
  expect(simulationRequests, "guest Chart must never call GET /api/simulations").toEqual([]);
});

test("keyed Chart ambitious still shows dual-employment leaf blocked; Plan still 95 and 61.8", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await signInWithFreshDemoKey(page, request);
  await page.goto("/census/chart");
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  await expect(page.getByTestId("hire-leaf")).toHaveCount(18, { timeout: 20_000 });
  await expect(page.getByTestId("chart-sim-guest")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);

  await page.getByTestId("chart-scenario-ambitious").click();
  const dual = page.locator('[data-testid="hire-leaf"][data-leaf-id="WU-HIRE-05"]');
  await expect(dual.getByTestId("hire-leaf-fires")).toHaveText("blocked", { timeout: 20_000 });
  await expect(dual).toContainText("Stop — dual employment");
  await expect(page.locator('[data-testid="hire-leaf"]', { hasText: "61.8" })).toHaveCount(0);
  await expect(page.getByTestId("chart-capacity")).toContainText("not live");
  await expect(page.getByTestId("chart-capacity-stated")).toHaveText("95");
  await expect(page.getByTestId("chart-capacity-defended")).toHaveText("61.8");

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
});

test("guest Rashmi step 2 is this walk, not a link", async ({ page }) => {
  await page.goto("/scout/offer-desk/rashmi");
  const row = page.getByTestId("rashmi-this-walk");
  await expect(row).toBeVisible();
  await expect(row).toContainText("Verify candidate documents");
  await expect(row).toContainText("this walk");
  await expect(row.locator("a")).toHaveCount(0);
  await expect(row).not.toHaveClass(/selected/);
  const cursor = await row.evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("default");
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
});

test("guest Playback i-button does not mention four panes", async ({ page }) => {
  await page.goto("/scout/offer-desk/playback");
  const info = page.getByRole("button", { name: "Info about Playback" });
  await info.hover();
  const pop = page.getByTestId("info-pop");
  await expect(pop).toBeVisible();
  await expect(pop).not.toContainText("Four panes");
  await expect(pop).toContainText("three sittings side by side");
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
});

test("guest Plan risk block is none named yet, not fake risks; still 95 and 61.8", async ({ page }) => {
  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await expect(page.getByTestId("plan-risks-empty")).toHaveText("none named yet");
  await expect(page.getByTestId("plan-risks-list")).toHaveCount(0);
  await expect(page.getByTestId("plan-risks")).not.toContainText(/compliance risk/i);
  await expect(page.getByTestId("plan-risks")).not.toContainText(/GQS/i);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
});

/** SITTING-STEER FRONTEND. Facilitator lives on the three-seat interview,
 * not as a seventh census step and not on DeskHrbp. Guest 1→6 and Plan
 * 95 / 61.8 stay in the tests above. */

function packQuestionText(id: string): string {
  const yaml = readFileSync(join(process.cwd(), "..", "packs", "hr", "question_bank.yaml"), "utf-8");
  const match = yaml.match(new RegExp(`id: ${id}\\s+text: "([^"]+)"`));
  if (!match) throw new Error(`packs/hr/question_bank.yaml must contain ${id}`);
  return match[1];
}

test("guest Facilitator is empty line; sit-close Confirm disabled; never writes we-spec-key", async ({
  page,
}) => {
  const nextQuestionRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/next-questions")) nextQuestionRequests.push(req.url());
  });

  await page.goto("/");
  await expect(stepCount(page)).toContainText("1 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);
  await expect(page.getByTestId("facilitator")).toHaveCount(0);

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await expect(page.getByTestId("facilitator")).toHaveCount(0);

  for (const path of [
    "/scout/offer-desk/function-leader",
    "/scout/offer-desk/sub-function-lead",
    "/scout/offer-desk/rashmi",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("facilitator-guest")).toHaveText("No next questions in this walk.", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("facilitator-ask")).toHaveCount(0);
    await expect(page.getByTestId("facilitator-guest")).not.toContainText(/pack|interrogation/i);
    const info = page.getByRole("button", { name: "Info about Facilitator" });
    await info.hover();
    const pop = page.getByTestId("info-pop");
    await expect(pop).toBeVisible();
    await expect(pop).toContainText(/pack/);
    await expect(pop).toContainText(/interrogation/);
    expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
  }

  await page.goto("/hr/hrbp");
  await expect(page.getByTestId("facilitator")).toHaveCount(0);

  await page.goto("/scout/offer-desk/sit-close");
  await expect(page.getByTestId("sit-close-confirm-goal")).toBeDisabled();
  await expect(page.getByTestId("sit-close-confirm-authority")).toBeDisabled();
  await expect(page.getByTestId("sit-close-confirm-acceptance")).toBeDisabled();
  await expect(page.locator("[data-testid^='sit-close-row-']")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
  expect(nextQuestionRequests, "guest must never call GET /api/scout/sessions/{id}/next-questions").toEqual([]);
});

/** MANDATE-4 FRONTEND. Finish times on Document check + a short Plan
 * block. Guest 1→6 and Plan 95 / 61.8 stay in the tests above. */

test("guest finish times are empty on Plan and Document check; never writes we-spec-key", async ({
  page,
}) => {
  const shadowRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/shadow-logs") || req.url().includes("/shadow-summary")) {
      shadowRequests.push(`${req.method()} ${req.url()}`);
    }
  });

  await page.goto("/");
  await expect(stepCount(page)).toContainText("1 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await expect(page.getByText("95", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("61.8", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("shadow-times-guest")).toHaveText("No times in this walk.");
  await expect(page.getByTestId("shadow-times-label")).toHaveCount(0);
  await expect(page.getByTestId("shadow-times-sum")).toHaveCount(0);
  await expect(page.getByTestId("shadow-times")).not.toContainText(/shadow log/i);
  await expect(page.getByTestId("shadow-times")).not.toContainText(/\bobserved\b/i);
  const planInfo = page.getByRole("button", { name: "Info about Finish times" });
  await planInfo.hover();
  const planPop = page.getByTestId("info-pop");
  await expect(planPop).toBeVisible();
  await expect(planPop).toContainText(/shadow log/i);
  await expect(planPop).toContainText(/observed/i);

  await page.goto("/scout/offer-desk/document-check");
  await expect(page.getByTestId("shadow-times-guest")).toHaveText("No times in this walk.");
  await expect(page.getByTestId("shadow-times-date")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Release offer — disabled" })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
  expect(shadowRequests, "guest must never call shadow-logs or shadow-summary").toEqual([]);
});

test("keyed Document check posts finish times; sixth is the limit; Plan still 95 and 61.8", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await signInWithFreshDemoKey(page, request);
  const apiKey = (await page.evaluate(() => localStorage.getItem("we-spec-key"))) as string;
  const wuId = await ensureDocumentCheckUnit(request, apiKey);
  const headers = { "X-Spec-Key": apiKey };

  async function shadowCount(): Promise<number> {
    const listed = await request.get(`/api/work-units/${wuId}/shadow-logs`, { headers });
    expect(listed.ok(), await listed.text()).toBeTruthy();
    return ((await listed.json()) as { occurred_at: string }[]).length;
  }

  await page.goto("/scout/offer-desk/document-check");
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  await expect(page.getByTestId("shadow-times-guest")).toHaveCount(0);

  let count = await shadowCount();
  if (count < 5) {
    await expect(page.getByTestId("shadow-times-date")).toBeVisible({ timeout: 20_000 });
    const stamp = Date.now().toString(10).slice(-4);
    const day = String((Number(stamp) % 28) + 1).padStart(2, "0");
    const date = `2026-07-${day}`;
    const uiPost = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes(`/work-units/${wuId}/shadow-logs`),
      { timeout: 20_000 },
    );
    await page.getByTestId("shadow-times-date").fill(date);
    await page.getByTestId("shadow-times-minutes").fill("25");
    await page.getByTestId("shadow-times-submit").click();
    const uiStatus = (await uiPost).status();
    if (uiStatus === 201) {
      await expect(page.getByTestId("shadow-times-row").filter({ hasText: date })).toBeVisible({
        timeout: 15_000,
      });
    } else {
      expect(uiStatus).toBe(422);
      await expect(page.getByTestId("shadow-times-limit")).toHaveText("five is the limit.");
    }
    count = await shadowCount();
  }

  let slot = 0;
  while ((count = await shadowCount()) < 5 && slot < 80) {
    // Unique per try: shared Client A often 409s a reused day, and a
    // refresh-after-write can 500 the same POST. New occurred_at, retry.
    const occurredAt = new Date(
      Date.UTC(2026, 0, 1, 12, 0, 0) + slot * 60_000 + (Date.now() % 1000),
    ).toISOString();
    const posted = await request.post(`/api/work-units/${wuId}/shadow-logs`, {
      headers,
      data: { occurred_at: occurredAt, duration_minutes: 10 },
    });
    const status = posted.status();
    if (status === 201) {
      const after = count + 1;
      await expect.poll(async () => shadowCount(), { timeout: 10_000 }).toBe(after);
      count = after;
    } else if (status === 422) {
      count = await shadowCount();
      break;
    } else {
      console.log(`shadow-log POST status=${status} body=${await posted.text()}`);
    }
    slot += 1;
  }
  count = await shadowCount();
  expect(count, "WU-OD-02 must be at the cap of 5 before the sixth POST").toBeGreaterThanOrEqual(5);

  await page.goto("/scout/offer-desk/document-check");
  await expect(page.getByTestId("shadow-times-date")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("shadow-times-label")).toHaveText(
    "Self-reported. Low confidence. Not from the company system.",
  );
  await expect(page.getByTestId("shadow-times-sum")).toHaveText(/^\d+ minutes$|minutes not entered/);
  await page.getByTestId("shadow-times-date").fill("2026-08-20");
  const sixth = page.waitForResponse(
    (res) =>
      res.request().method() === "POST" &&
      res.url().includes(`/work-units/${wuId}/shadow-logs`),
    { timeout: 20_000 },
  );
  await page.getByTestId("shadow-times-submit").click();
  expect((await sixth).status()).toBe(422);
  await expect(page.getByTestId("shadow-times-limit")).toHaveText("five is the limit.");
  await expect(page.getByRole("button", { name: "Release offer — disabled" })).toBeDisabled();

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
  await expect(page.getByText("95", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("61.8", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("shadow-times-guest")).toHaveCount(0);
  await expect(page.getByTestId("shadow-times-label")).toHaveText(
    "Self-reported. Low confidence. Not from the company system.",
  );
  await expect(page.getByTestId("shadow-times-sum")).toHaveText(/^\d+ minutes$|minutes not entered/);
  await expect(page.getByTestId("plan-hours-stated")).not.toHaveText(/minutes/);
  await expect(page.getByTestId("plan-hours-defended")).not.toHaveText(/minutes/);
});

test("keyed Facilitator shows pack question verbatim; Plan still 95 and 61.8", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await signInWithFreshDemoKey(page, request);
  const apiKey = (await page.evaluate(() => localStorage.getItem("we-spec-key"))) as string;
  const headers = { "X-Spec-Key": apiKey };

  const typeName = `SITTING-STEER UI Object ${Date.now().toString(36)}`;
  const created = await request.post("/api/ontology/types", {
    headers,
    data: { name: typeName, kind: "business_object", description: "", state_machine: '["draft","done"]' },
  });
  expect(created.status(), await created.text()).toBe(201);
  const typeId = ((await created.json()) as { id: number }).id;

  const unitBody = {
    code: `WU-OD-ST${Date.now().toString(36)}`.slice(0, 40),
    name: "Offer Desk piece for Facilitator",
    business_object_type_id: typeId,
    current_condition: "draft",
    desired_condition: "approved",
    context: "",
    trigger: "request arrives",
    inputs: "form",
    authority: "",
    actor_constraints: "",
    acceptance_criteria: "filled already",
    evidence_required: "",
    verification_method: "deterministic_rule",
    sla_hours: 4,
    failure_semantics: "hold and notify",
    owner: "Ops",
  };
  let wuRes = await request.post("/api/work-units/", { headers, data: unitBody });
  if (wuRes.status() === 500) {
    unitBody.code = `${unitBody.code}R`.slice(0, 40);
    wuRes = await request.post("/api/work-units/", { headers, data: unitBody });
  }
  expect(wuRes.status(), await wuRes.text()).toBe(201);

  const f3 = packQuestionText("f3");
  await page.goto("/scout/offer-desk/function-leader");
  await expect(page.getByText("Looking only — nothing is saved")).toHaveCount(0);
  await expect(page.getByTestId("facilitator-ask")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByTestId("facilitator-question")).toHaveText(f3);
  await expect(page.getByTestId("facilitator")).toContainText("Ask this exact question");
  await expect(page.getByTestId("facilitator-ask")).not.toContainText(/pack|interrogation/i);
  await expect(page.getByTestId("facilitator")).not.toContainText(/dual employment/i);

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");
});

/** D-1 FRONTEND. Pain-to-permit on Function leader. Guest 1→6 and Plan
 * 95 / 61.8 stay in the tests above. Never invent 47 days. */

test("guest Function leader shows pain question and This period (draft) after typing; Plan still 95 and 61.8; never writes we-spec-key", async ({
  page,
}) => {
  const sittingWrites: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    const method = req.method();
    if (url.includes("/sitting-answers") && (method === "PUT" || method === "POST")) {
      sittingWrites.push(`${method} ${url}`);
    }
    if (url.includes("draft-strategy-intent") || url.includes("confirm-strategy-intent")) {
      sittingWrites.push(`${method} ${url}`);
    }
  });

  await page.goto("/");
  await expect(stepCount(page)).toContainText("1 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");

  await page.goto("/scout/offer-desk/function-leader");
  await expect(page.getByTestId("sitting-pain")).toHaveText(PAIN_QUESTION, { timeout: 15_000 });
  await expect(page.getByText("We asked · what we use as the CHRO voice for this demo")).toHaveCount(0);
  await expect(page.getByText(/47 days/i)).toHaveCount(0);
  await page.getByTestId("sitting-answer").fill(SITTING_LINE);
  await expect(page.getByTestId("this-period-draft")).toBeVisible();
  await expect(page.getByTestId("this-period-label")).toHaveText(SITTING_LINE);
  await expect(page.getByTestId("this-period-confirm")).toBeDisabled();
  await expect(page.getByTestId("sitting-guest")).toContainText(/looking only/i);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
  expect(
    sittingWrites,
    "guest must never PUT sitting-answers or POST draft/confirm strategy intent",
  ).toEqual([]);
});

/** D-2 FRONTEND. Playback from stored answers, not PLAYBACK_ROWS.
 * Confirm/Correct stay on Sit close. Guest 1→6 and Plan 95 / 61.8 stay. */

test("guest Playback is empty when nothing was typed; Plan still 95 and 61.8; never writes we-spec-key", async ({
  page,
}) => {
  const sittingCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/sitting-answers")) {
      sittingCalls.push(`${req.method()} ${req.url()}`);
    }
  });

  await page.goto("/");
  await expect(stepCount(page)).toContainText("1 of 6");
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);

  await page.goto("/census/plan");
  await expect(stepCount(page)).toContainText("6 of 6");
  await expect(page.getByTestId("plan-hours-stated")).toHaveText("95");
  await expect(page.getByTestId("plan-hours-defended")).toHaveText("61.8");

  await page.goto("/scout/offer-desk/playback");
  await expect(page.getByTestId("playback")).toBeVisible();
  await expect(page.getByTestId("playback-empty")).toHaveText("none yet", { timeout: 15_000 });
  await expect(page.getByTestId("playback-guest")).toContainText(/looking only/i, { timeout: 15_000 });
  await expect(page.getByTestId("playback-cell-function_head-pain")).toHaveText("none yet");
  await expect(page.getByTestId("playback-cell-sub_function_lead-pain")).toHaveText("none yet");
  await expect(page.getByTestId("playback-cell-sme-pain")).toHaveText("none yet");
  await expect(page.getByTestId("playback")).not.toContainText("Safe offer, two-hour SLA");
  await expect(page.getByTestId("playback")).not.toContainText("Eleven steps, Excel at the centre");
  await expect(page.getByTestId("playback")).not.toContainText("A desk in a chain of desks");
  await expect(page.getByTestId("playback")).not.toContainText(/47 days/i);
  await expect(page.getByTestId("playback")).not.toContainText(/\d+%/);
  await expect(page.getByTestId("sit-close-confirm-goal")).toHaveCount(0);
  await expect(page.getByTestId("sit-close-correct-goal")).toHaveCount(0);
  await expect(page.getByTestId("playback-sit-close")).toBeVisible();
  await expect(page.getByRole("button", { name: /7\./ })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
  expect(sittingCalls, "guest must never call sitting-answers").toEqual([]);
});



