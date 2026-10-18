import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    url: `http://localhost:${port}/api/reference-data`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
