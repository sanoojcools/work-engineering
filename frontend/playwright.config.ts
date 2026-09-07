import { defineConfig, devices } from "@playwright/test";

/** CENSUS-v0's required Playwright coverage (docs/BUILD_PROGRAM.md). Backend
 * and frontend are started as separate steps (real Postgres, real uvicorn,
 * real vite preview/dev) rather than through Playwright's own webServer —
 * this suite exercises real HTTP end to end, not a mocked page. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Pre-installed browser in some environments; unset (default
        // Playwright-managed browser, e.g. after `playwright install`) elsewhere.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
});
