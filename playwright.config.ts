import { defineConfig, devices } from "@playwright/test";

// Own port, test database, scratch storage folder and test-only auth settings, so a dev server you have running (and your
// .env.local) never affects the tests. These values are not secrets.
const PORT = 3100;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/livingtext_test";
export const E2E_AUTH_SECRET = "e2e-only-secret-not-used-anywhere-else-0123456789";
export const E2E_ADMIN_EMAIL = "admin@example.test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Brings the test database up to date (storage tests need it).
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      AUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_GOOGLE_ID: "e2e",
      AUTH_GOOGLE_SECRET: "e2e",
      AUTH_URL: `http://localhost:${PORT}`,
      ADMIN_EMAILS: E2E_ADMIN_EMAIL,
      DATABASE_URL: TEST_DATABASE_URL,
      // On so the translation menu can be tested; the key is a placeholder and tests never request
      // ESV text from Crossway (only chapters outside the ESV scope are used).
      ESV_ENABLED: "true",
      ESV_API_KEY: "e2e-placeholder-not-a-real-key",
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_DIR: ".local-storage/e2e",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
