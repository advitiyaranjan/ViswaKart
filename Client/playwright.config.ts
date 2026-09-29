import { defineConfig, devices } from "@playwright/test";

const PORT = 5179;

/**
 * Responsive smoke tests on the three targets we support: Android (Chromium), iOS (WebKit) and laptops.
 * The API is mocked in tests/e2e/fixtures.ts, so no backend or database is needed.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "ios", use: { ...devices["iPhone 14"] } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Point the app at a fake API origin that the tests intercept.
    env: { VITE_API_URL: "http://api.test.local/api" },
  },
});
