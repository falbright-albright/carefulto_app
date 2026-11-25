import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the full stack (`docker compose up`), served on :3001.
// Override with BASE_URL to point at another environment.
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
