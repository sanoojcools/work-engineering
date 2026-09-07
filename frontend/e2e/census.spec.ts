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

test("guest walks Scope through Plan (1 of 6 .. 6 of 6); Work Chart shows Offer Desk and Onboarding lanes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Scope", exact: false }).first()).toBeVisible();
  await expect(stepCount(page)).toContainText("1 of 6");

  await page.getByRole("link", { name: "Next: Capture →" }).click();
  await expect(page).toHaveURL(/\/census\/capture$/);
  await expect(stepCount(page)).toContainText("2 of 6");
  await expect(page.getByRole("heading", { name: "Capture", exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: "Next: Evidence →" }).click();
  await expect(page).toHaveURL(/\/census\/evidence$/);
  await expect(stepCount(page)).toContainText("3 of 6");

  await page.getByRole("link", { name: "Next: Gap →" }).click();
  await expect(page).toHaveURL(/\/census\/gap$/);
  await expect(stepCount(page)).toContainText("4 of 6");
  // Guest sees the four illustrative gap rows, not a live fetch.
  await expect(page.getByText("What the work is")).toBeVisible();

  await page.getByRole("link", { name: "Next: Work Chart →" }).click();
  await expect(page).toHaveURL(/\/census\/chart$/);
  await expect(stepCount(page)).toContainText("5 of 6");
  await expect(page.getByRole("heading", { name: "Offer Desk", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Onboarding", exact: true })).toBeVisible();
  // Guest: declared DeskSpec schematic only, every unit reads not scored.
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
