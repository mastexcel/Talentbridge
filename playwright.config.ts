import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours E2E critiques : application construite (`npm run build`) et base de démo seedée
 * (`npm run db:seed`). Chromium préinstallé : CHROMIUM_PATH le cas échéant.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/v1/health`,
    reuseExistingServer: true,
    env: { APP_URL: `http://localhost:${PORT}`, AUTH_RATE_LIMIT_FACTOR: "50", ALLOW_MOCK_PAYMENTS: "true" },
  },
});
