import { defineConfig, devices } from "@playwright/test";

// The suite starts its own API (fresh SQLite + demo data, external APIs off) and a
// production build of the web app, on ports that don't clash with `npm run dev`.
const API_PORT = 8001;
const WEB_PORT = 3001;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Locally, drive the installed Chrome instead of downloading a browser.
    ...(CI ? {} : { channel: "chrome" }),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(CI ? {} : { channel: "chrome" }) } }],
  webServer: [
    {
      command:
        "rm -f e2e.db && rm -rf e2e-uploads && uv run python -m app.seed --demo && uv run uvicorn app.main:app --port " +
        API_PORT,
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        DATABASE_URL: "sqlite:///./e2e.db",
        UPLOAD_DIR: "e2e-uploads",
        ENABLE_EXTERNAL_APIS: "false",
        // Exercise the on-device OCR path; ignore any AI keys in backend/.env.
        GROQ_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        CORS_ORIGINS: `["http://localhost:${WEB_PORT}"]`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run build && npm run start -- -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
