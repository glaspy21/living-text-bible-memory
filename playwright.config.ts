import { defineConfig, devices } from "@playwright/test";

// Own port and test-only auth settings, so a dev server you have running (and your
// .env.local) never affects the tests. These values are not secrets.
const PORT = 3100;
export const E2E_AUTH_SECRET = "e2e-only-secret-not-used-anywhere-else-0123456789";
export const E2E_ADMIN_EMAIL = "admin@example.test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      AUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_GOOGLE_ID: "e2e",
      AUTH_GOOGLE_SECRET: "e2e",
      AUTH_URL: `http://localhost:${PORT}`,
      ADMIN_EMAILS: E2E_ADMIN_EMAIL,
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
