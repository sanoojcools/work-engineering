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

/** Seed one Work Unit + an XLSX pointer (and a broken / composed / binding
 * sibling) through the real API so Evidence can click them. Unique code so
 * a warm Client A tenant from an earlier run does not 409. Unique type so
 * we do not reuse types.items[0] after a V10-2 evidence-pack genome import. */
async function seedEvidencePointers(request: APIRequestContext, apiKey: string): Promise<{
  code: string;
  wuId: number;
  fileName: string;
  cell: string;
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

  return { code: usedCode, wuId, fileName, cell };
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
  const loadingCensus = page.getByText("Loading this tenant's census…");
  await expect(startedBadge.or(keyedStartHint).or(loadingCensus)).toBeVisible({ timeout: 15_000 });
  await expect(loadingCensus).toHaveCount(0, { timeout: 15_000 });
  if ((await startedBadge.count()) > 0) return;
  await expect(keyedStartHint).toBeVisible();
  await page.getByRole("button", { name: "Start census" }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(startedBadge).toBeVisible({ timeout: 15_000 });
}

test("guest walks Scope through Plan (1 of 6 .. 6 of 6); Work Chart shows 18 leaves and an external band", async ({ page }) => {
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
  await expect(page.getByTestId("census-copy-headings").getByText(/Careful \/ as calculated \/ ambitious/)).toBeVisible();

  // Guest Start does not mint a key and does not leave Scope.
  await page.getByRole("button", { name: "Start census" }).click();
  await expect(stepCount(page)).toContainText("1 of 6");
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();

  await page.getByRole("link", { name: "Next: Capture →" }).click();
  await expect(page).toHaveURL(/\/census\/capture$/);
  await expect(stepCount(page)).toContainText("2 of 6");
  await expect(page.getByRole("heading", { name: "Capture", exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: "Next: Evidence →" }).click();
  await expect(page).toHaveURL(/\/census\/evidence$/);
  await expect(stepCount(page)).toContainText("3 of 6");
  // F1: a real screen, not a link farm -- files this tenant actually has
  // (empty, honestly, for a guest) and three registers with counts, all
  // rendered with no key ever minted just by looking.
  await expect(page.getByText("No files in this walk")).toBeVisible();
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
  // Guest sees the four illustrative gap rows, not a live fetch.
  await expect(page.getByText("What the work is")).toBeVisible();
  // F2: journey-wide additions -- Head vs doer schematic, and an explicit
  // no-coverage-percentage statement (never a fake measured-vs-declared KPI).
  await expect(page.getByText("Head vs doer")).toBeVisible();
  await expect(page.getByText(/There is no "coverage" number on this page/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();

  await page.getByRole("link", { name: "Next: Work Chart →" }).click();
  await expect(page).toHaveURL(/\/census\/chart$/);
  await expect(stepCount(page)).toContainText("5 of 6");
  await expect(page.getByRole("heading", { name: /The hire is complete/ })).toBeVisible();
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
  // Guest: declared seed only, every piece reads not scored.
  await expect(page.getByText("not scored").first()).toBeVisible();
  await expect(page.getByText("Guest: shown as candidate")).toBeVisible();

  await page.getByRole("link", { name: "Next: Plan →" }).click();
  await expect(page).toHaveURL(/\/census\/plan$/);
  await expect(stepCount(page)).toContainText("6 of 6");
  // E -- PLAN: 95/61.8 visible directly on Plan itself, not just behind a
  // click through to the Hours page.
  await expect(page.getByText("95", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("61.8", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/~30\/90 is not a pass/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("we-spec-key"))).toBeNull();
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

test("Hours 95 declared / 61.8 defended still visible from Plan", async ({ page }) => {
  await page.goto("/census/plan");
  await page.getByRole("link", { name: /Hours — 95 declared/ }).click();
  await expect(page).toHaveURL(/\/scout\/offer-desk\/hours$/);
  await expect(page.getByText("95", { exact: true })).toBeVisible();
  await expect(page.getByText("61.8", { exact: true })).toBeVisible();
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

test("keyed Evidence lists this tenant's real uploaded files and what each one backs", async ({ page, request }) => {
  // V10-2 Evidence file-list walk — kept alongside the pointer test below
  // and the V10-4 Chart 18-leaf / external-band assertions.
  // 7 sequential real file uploads + a genome import comfortably exceed the
  // suite's default 30s per-test budget.
  test.setTimeout(60_000);
  await signInWithFreshDemoKey(page, request);

  // Real upload + real genome import -- the one path in this walk that
  // clears the quality gate (see OfferDeskEvidencePack.tsx). 9 of its 11
  // Work Units cite one of the 7 uploaded files; uan-service-history-sample.csv
  // is uploaded but cited by none, on purpose (offerDeskEvidencePack.json).
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

  await page.goto("/census/evidence");
  await expect(page.getByRole("heading", { name: "Evidence", exact: false }).first()).toBeVisible();

  const filesTable = page.locator(".table-wrap").first();
  // This run's own 7 uploads are real either way.
  await expect(filesTable.getByText("zwayam-candidate-export.csv").first()).toBeVisible();
  // Some file on this tenant backs a real Offer Desk unit with a real code +
  // plain-word claim -- from this run if the import was freshly accepted,
  // or from whichever earlier run first seeded this tenant otherwise.
  await expect(filesTable.getByText(/WU-OD-\d+/).first()).toBeVisible();
  // uan-service-history-sample.csv is never cited by this fixture's own
  // provenance map, on every run -- says so, honestly, instead of a blank
  // cell (.first() only guards against a warm tenant holding one such row
  // per earlier run; the property being checked is the same on all of them).
  const orphanRow = filesTable.locator("tr", { has: page.getByText("uan-service-history-sample.csv") }).first();
  await expect(orphanRow.getByText("Backs nothing yet.")).toBeVisible();

  // Real conformance-gap counts, not the guest's illustrative four rows.
  await expect(page.getByText(/Read from this tenant's own conformance gaps/)).toBeVisible();
});

test("keyed Evidence click shows a real XLSX cell; a broken pointer is not a fact", async ({ page, request }) => {
  // V10-2 pointer walk (kept with V10-4 Chart 18-leaf / external-band).
  // Fresh CI Postgres still shares Client A: Start census, GET /pointers,
  // and the click must all finish inside one job. Unique type + one 500
  // retry above so a prior evidence-pack import does not fail this seed.
  test.setTimeout(90_000);
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
  await page.goto("/census/evidence");
  await pointersLoaded;
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
  expect(content).toMatch(/not a pass/);
  expect(content).toContain("The hire is complete");
  expect(content).toContain("Outside this desk");
  expect(content).not.toMatch(/WU-HIRE-19/);
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
